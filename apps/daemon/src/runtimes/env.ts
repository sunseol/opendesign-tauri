import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { amrVelaProfileEnv } from '../integrations/vela-profile.js';
import { resolveProjectRelativePath } from '../home-expansion.js';
import { resolveProjectRootFromNestedModule } from '../project-root.js';
import {
  applySandboxRuntimeEnv,
  isSandboxModeEnabled,
  resolveSandboxRuntimeConfig,
  type SandboxRuntimeConfig,
} from '../sandbox-mode.js';
import { expandConfiguredEnv } from './paths.js';

type RuntimeEnvMap = NodeJS.ProcessEnv | Record<string, string>;

const RUNTIME_PROJECT_ROOT = resolveProjectRootFromNestedModule(
  dirname(fileURLToPath(import.meta.url)),
);

// Build the env passed to spawn() for a given agent adapter.
//
// The claude adapter strips ANTHROPIC_API_KEY so Claude Code's own auth
// resolution (claude login / Pro/Max plan) wins instead of silently
// falling back to API-key billing whenever the daemon happened to be
// launched from a shell that exported the key for SDK or scripting use.
// See issue #398.
//
// However, when ANTHROPIC_BASE_URL is set the user is intentionally
// routing Claude Code to a custom endpoint (e.g. a Kimi/Moonshot proxy).
// In that case claude login is meaningless, so preserve the API key so
// the child can authenticate against the custom base URL.
//
// The codex adapter has the symmetric problem: a stale BYOK
// OPENAI_API_KEY / CODEX_API_KEY left behind in app-config.json silently
// outranks Codex CLI's own `~/.codex/auth.json` (codex login) and trips
// 401 invalid_api_key whenever execution mode is switched back to
// Local CLI. Strip both keys unless the user has also configured a
// custom OPENAI_BASE_URL — i.e. they are intentionally routing Codex
// CLI through a third-party OpenAI-compatible gateway. See issue #2420.
//
// Windows env-var names are case-insensitive at the kernel level
// (`GetEnvironmentVariable`), but spreading `process.env` into a plain
// object loses Node's case-insensitive accessor — `Anthropic_Api_Key`
// would survive a literal `delete env.ANTHROPIC_API_KEY` and still reach
// the child. Iterate keys and compare case-insensitively to close that.
export function spawnEnvForAgent(
  agentId: string,
  baseEnv: RuntimeEnvMap,
  configuredEnv: unknown = {},
): NodeJS.ProcessEnv {
  const sandboxRuntime = sandboxRuntimeConfigForBaseEnv(baseEnv);
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    ...expandConfiguredEnv(configuredEnv),
  };
  if (agentId === 'amr') {
    Object.assign(env, amrVelaProfileEnv(env));
    if (!env.HOME?.trim()) {
      const home = homedir();
      if (home) env.HOME = home;
    }
    if (!env.AMR_CLIENT_SOURCE?.trim()) {
      env.AMR_CLIENT_SOURCE = 'open_design';
    }
    if (!env.OPENCODE_TEST_HOME?.trim() && env.OD_DATA_DIR?.trim()) {
      env.OPENCODE_TEST_HOME = join(
        env.OD_DATA_DIR.trim(),
        'amr',
        'opencode-home',
      );
    }
    return reapplySandboxRuntimeEnv(env, sandboxRuntime);
  }
  if (agentId === 'opencode') {
    stripKeysCaseInsensitive(env, [
      'OPENCODE',
      'OPENCODE_PID',
      'OPENCODE_RUN_ID',
      'OPENCODE_SERVER_PASSWORD',
    ]);
    if (!env.OPENCODE_DISABLE_PROJECT_CONFIG?.trim()) {
      env.OPENCODE_DISABLE_PROJECT_CONFIG = 'true';
    }
    return reapplySandboxRuntimeEnv(env, sandboxRuntime);
  }
  if (agentId === 'claude') {
    stripUnlessCustomBaseUrl(env, 'ANTHROPIC_BASE_URL', ['ANTHROPIC_API_KEY']);
    return reapplySandboxRuntimeEnv(env, sandboxRuntime);
  }
  if (agentId === 'codex') {
    stripUnlessCustomBaseUrl(env, 'OPENAI_BASE_URL', [
      'OPENAI_API_KEY',
      'CODEX_API_KEY',
    ]);
    return reapplySandboxRuntimeEnv(env, sandboxRuntime);
  }
  return reapplySandboxRuntimeEnv(env, sandboxRuntime);
}

export function openDesignAmrTraceEnv(input: {
  agentId: string;
  runId: string;
  conversationId?: string | null;
  runAttempt: number;
}): NodeJS.ProcessEnv {
  if (input.agentId !== 'amr') return {};

  const runId = input.runId.trim();
  if (!runId) {
    throw new Error('OPEN_DESIGN_RUN_ID requires a non-empty run id for AMR runs');
  }
  if (!Number.isFinite(input.runAttempt) || input.runAttempt < 0) {
    throw new Error('OPEN_DESIGN_RUN_ATTEMPT requires a non-negative finite attempt index');
  }

  const conversationId = input.conversationId?.trim();
  return {
    OPEN_DESIGN_RUN_ID: runId,
    OPEN_DESIGN_RUN_ATTEMPT: String(Math.floor(input.runAttempt)),
    ...(conversationId ? { OPEN_DESIGN_SESSION_ID: conversationId } : {}),
  };
}

function sandboxRuntimeConfigForBaseEnv(
  baseEnv: RuntimeEnvMap,
): SandboxRuntimeConfig | null {
  if (!isSandboxModeEnabled(baseEnv)) return null;
  const dataDir = baseEnv.OD_DATA_DIR?.trim();
  if (!dataDir) return null;
  return resolveSandboxRuntimeConfig(
    true,
    resolveProjectRelativePath(dataDir, RUNTIME_PROJECT_ROOT),
  );
}

function reapplySandboxRuntimeEnv(
  env: NodeJS.ProcessEnv,
  sandboxRuntime: SandboxRuntimeConfig | null,
): NodeJS.ProcessEnv {
  if (!sandboxRuntime) return env;
  return applySandboxRuntimeEnv(env, sandboxRuntime);
}

// Remove `secretKeys` from `env` unless `baseUrlKey` is set to a non-empty
// value — in which case the user is intentionally routing the CLI through
// a custom endpoint and the secret is the credential that authenticates
// against it. Comparison is case-insensitive so Windows env names with
// mixed casing (`Openai_Api_Key`) cannot slip past a literal `delete`.
function stripUnlessCustomBaseUrl(
  env: NodeJS.ProcessEnv,
  baseUrlKey: string,
  secretKeys: readonly string[],
): void {
  const baseUrlKeyUpper = baseUrlKey.toUpperCase();
  const hasCustomBaseUrl = Object.keys(env).some(
    (k) =>
      k.toUpperCase() === baseUrlKeyUpper &&
      typeof env[k] === 'string' &&
      env[k].trim() !== '',
  );
  if (hasCustomBaseUrl) return;
  stripKeysCaseInsensitive(env, secretKeys);
}

function stripKeysCaseInsensitive(
  env: NodeJS.ProcessEnv,
  keysToStrip: readonly string[],
): void {
  const keysUpper = new Set(keysToStrip.map((key) => key.toUpperCase()));
  for (const key of Object.keys(env)) {
    if (keysUpper.has(key.toUpperCase())) delete env[key];
  }
}
