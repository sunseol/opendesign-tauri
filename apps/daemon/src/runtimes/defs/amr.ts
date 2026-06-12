import { execAgentFile } from './shared.js';
import type { RuntimeAgentDef, RuntimeModelOption } from '../types.js';

const AMR_MODELS_TIMEOUT_MS = 10_000;
const AMR_MODELS_RETRY_DELAYS_MS = [250, 750] as const;

export type VelaModelJsonSource = 'preset' | 'remote';

const PREFERRED_AMR_CHAT_MODEL_ORDER = [
  'deepseek-v4-flash',
  'deepseek-v3.2',
  'glm-5.1',
  'gemini-2.5-flash',
] as const;

const PREFERRED_AMR_CHAT_MODEL_RANK: ReadonlyMap<string, number> = new Map(
  PREFERRED_AMR_CHAT_MODEL_ORDER.map((id, index) => [id, index]),
);

// AMR is the Vela CLI's ACP stdio runtime. The daemon drives it through
// `vela agent run --runtime opencode`, then sends the selected live model via
// ACP `session/set_model`.
export function normalizeVelaModelId(rawId: string): string | null {
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const withoutProvider = trimmed.startsWith('vela/')
    ? trimmed.slice('vela/'.length)
    : trimmed;
  const withoutPrefix = withoutProvider.startsWith('public_model_')
    ? withoutProvider.slice('public_model_'.length)
    : withoutProvider;
  if (!withoutPrefix) return null;
  if (/^deepseek_v3_2$/i.test(withoutPrefix)) return 'deepseek-v3.2';
  if (/^deepseek-v3-2$/i.test(withoutPrefix)) return 'deepseek-v3.2';
  if (/^kimi_k2_6$/i.test(withoutPrefix)) return 'kimi-k2.6';
  if (/^glm_5_1$/i.test(withoutPrefix)) return 'glm-5.1';
  if (/^glm_5$/i.test(withoutPrefix)) return 'glm-5';
  const versioned = normalizeKnownVelaVersionId(withoutPrefix);
  if (versioned) return versioned;
  return withoutPrefix.replace(/_/g, '-');
}

function normalizeKnownVelaVersionId(rawId: string): string | null {
  const claude = /^claude[_-](haiku|opus|sonnet)[_-](\d+)[_-](\d+)(.*)$/i.exec(rawId);
  if (claude) {
    const [, family, major, minor, suffix = ''] = claude;
    if (!family || !major || !minor) return null;
    return `claude-${family.toLowerCase()}-${major}.${minor}${suffix.replace(/_/g, '-')}`;
  }

  const gpt = /^gpt_(\d+)_(\d+)(.*)$/i.exec(rawId);
  if (gpt) {
    const [, major, minor, suffix = ''] = gpt;
    if (!major || !minor) return null;
    return `gpt-${major}.${minor}${suffix.replace(/_/g, '-')}`;
  }

  const gemini = /^gemini_(\d+)_(\d+)(.*)$/i.exec(rawId);
  if (gemini) {
    const [, major, minor, suffix = ''] = gemini;
    if (!major || !minor) return null;
    return `gemini-${major}.${minor}${suffix.replace(/_/g, '-')}`;
  }

  const minimax = /^minimax_m(\d+)_(\d+)(.*)$/i.exec(rawId);
  if (minimax) {
    const [, major, minor, suffix = ''] = minimax;
    if (!major || !minor) return null;
    return `minimax-m${major}.${minor}${suffix.replace(/_/g, '-')}`;
  }

  return null;
}

function isVelaChatModelId(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (id.startsWith('gpt-image-')) return false;
  if (id.startsWith('seedance-')) return false;
  if (id.startsWith('doubao-seedance-')) return false;
  if (id.startsWith('veo-')) return false;
  if (id.startsWith('imagen-')) return false;
  return true;
}

export function parseVelaModels(stdout: string): RuntimeModelOption[] {
  const seen = new Set<string>();
  const models: RuntimeModelOption[] = [];
  for (const line of String(stdout || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [rawId] = trimmed.split(/\s+/);
    if (!rawId) continue;
    const id = normalizeVelaModelId(rawId);
    if (!id || seen.has(id) || !isVelaChatModelId(id)) continue;
    seen.add(id);
    models.push({ id, label: id });
  }
  return orderAmrChatModels(models);
}

export function parseVelaModelJson(
  stdout: string,
  expectedSource: VelaModelJsonSource,
): RuntimeModelOption[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Invalid vela model JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid vela model JSON: expected object');
  }
  const source = (parsed as { source?: unknown }).source;
  if (source !== expectedSource) {
    throw new Error(
      `Invalid vela model JSON source: expected ${expectedSource}, got ${String(source)}`,
    );
  }
  const data = (parsed as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error('Invalid vela model JSON: expected data array');
  }
  const seen = new Set<string>();
  const models: RuntimeModelOption[] = [];
  for (const item of data) {
    const rawId =
      item && typeof item === 'object'
        ? (item as { id?: unknown }).id
        : null;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id || seen.has(id) || !isVelaChatModelId(id)) continue;
    seen.add(id);
    models.push({ id, label: id });
  }
  return orderAmrChatModels(models);
}

function orderAmrChatModels(
  models: RuntimeModelOption[],
): RuntimeModelOption[] {
  return models
    .map((model, index) => ({ model, index }))
    .sort((a, b) => {
      const aRank =
        PREFERRED_AMR_CHAT_MODEL_RANK.get(a.model.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank =
        PREFERRED_AMR_CHAT_MODEL_RANK.get(b.model.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.index - b.index;
    })
    .map(({ model }) => model);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function velaModelsErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? '');
}

function isRetriableVelaModelsError(error: unknown): boolean {
  const message = velaModelsErrorMessage(error).toLowerCase();
  return [
    'deadline exceeded',
    'timed out',
    'timeout',
    'temporarily unavailable',
    'temporary failure',
    'econnreset',
    'econnrefused',
    'enotfound',
    '502',
    '503',
    '504',
  ].some((pattern) => message.includes(pattern));
}

async function fetchVelaRemoteModelsWithRetry(
  resolvedBin: string,
  env: NodeJS.ProcessEnv,
): Promise<RuntimeModelOption[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= AMR_MODELS_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const { stdout } = await execAgentFile(
        resolvedBin,
        ['model', 'list', '--format', 'json'],
        {
          env,
          timeout: AMR_MODELS_TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
        },
      );
      return parseVelaModelJson(String(stdout), 'remote');
    } catch (error) {
      lastError = error;
      if (
        attempt === AMR_MODELS_RETRY_DELAYS_MS.length ||
        !isRetriableVelaModelsError(error)
      ) {
        throw error;
      }
      await sleep(AMR_MODELS_RETRY_DELAYS_MS[attempt] ?? 0);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(velaModelsErrorMessage(lastError));
}

export const amrAgentDef = {
  id: 'amr',
  name: 'AMR',
  bin: 'vela',
  versionArgs: ['--version'],
  fetchModels: fetchVelaRemoteModelsWithRetry,
  fallbackModels: [],
  buildArgs: () => ['agent', 'run', '--runtime', 'opencode'],
  streamFormat: 'acp-json-rpc',
  mcpDiscovery: 'mature-acp',
  externalMcpInjection: 'acp-merge',
  supportsCustomModel: false,
  supportsImagePaths: true,
} satisfies RuntimeAgentDef;
