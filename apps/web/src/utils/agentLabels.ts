const AGENT_LABELS: Record<string, string> = {
  aider: 'Aider',
  amp: 'Amp',
  claude: 'Claude',
  codebuddy: 'Codebuddy',
  codex: 'Codex',
  devin: 'Devin',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  amr: 'AMR',
  'cursor-agent': 'Cursor',
  cursor: 'Cursor',
  qwen: 'Qwen',
  qoder: 'Qoder',
  copilot: 'Copilot',
  deepseek: 'DeepSeek',
  antigravity: 'Antigravity',
  'anthropic-api': 'Anthropic API',
  'openai-api': 'OpenAI API',
  'azure-openai-api': 'Azure OpenAI',
  'google-gemini-api': 'Google Gemini',
};

const AGENT_ALIASES: Record<string, string> = {
  'amp cli': 'amp',
  'amp-cli': 'amp',
  'claude code': 'claude',
  'codebuddy code': 'codebuddy',
  cbc: 'codebuddy',
  'codex cli': 'codex',
  'devin for terminal': 'devin',
  'gemini cli': 'gemini',
  'cursor agent': 'cursor-agent',
  'qwen code': 'qwen',
  'qoder cli': 'qoder',
  'qodercli': 'qoder',
  'github copilot cli': 'copilot',
  'deepseek tui': 'deepseek',
  'deepseek-tui': 'deepseek',
  'aider cli': 'aider',
  'aider chat': 'aider',
  agy: 'antigravity',
};

export function agentDisplayName(
  agentId?: string | null,
  fallbackName?: string | null,
): string | null {
  for (const raw of [agentId, fallbackName]) {
    const known = knownAgentLabel(raw);
    if (known) return known;
  }
  for (const raw of [fallbackName, agentId]) {
    const fallback = safeFallbackLabel(raw);
    if (fallback) return fallback;
  }
  return null;
}

export function agentIconId(
  agentId?: string | null,
  fallbackName?: string | null,
): string {
  for (const raw of [agentId, fallbackName]) {
    if (!raw) continue;
    const base = raw.split(' · ')[0]?.trim() || raw;
    const key = normalizeKey(base);
    const alias = AGENT_ALIASES[key] ?? key;
    if (AGENT_LABELS[alias]) return alias;
    if (alias.includes('cursor-agent')) return 'cursor-agent';
    for (const id of Object.keys(AGENT_LABELS)) {
      if (containsAgentId(alias, id)) return id;
    }
  }
  const fallback = normalizeKey(agentId ?? fallbackName ?? '');
  return fallback || 'claude';
}

export function exactAgentDisplayName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  const alias = AGENT_ALIASES[key] ?? key;
  return AGENT_LABELS[alias] ?? null;
}

export function agentModelDisplayName(
  agentId?: string | null,
  fallbackName?: string | null,
  model?: string | null,
): string | undefined {
  const label = agentDisplayName(agentId, fallbackName) ?? undefined;
  const modelId = displayableModelId(model);
  if (!modelId) return label;
  return label ? `${label} · ${modelId}` : modelId;
}

function knownAgentLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  const alias = AGENT_ALIASES[key] ?? key;
  const direct = AGENT_LABELS[alias];
  if (direct) return direct;
  if (key.includes('cursor-agent')) return 'Cursor';
  if (key.includes('copilot')) return 'Copilot';
  for (const [agentId, label] of Object.entries(AGENT_LABELS)) {
    if (containsAgentId(key, agentId)) return label;
  }
  return null;
}

function containsAgentId(key: string, agentId: string): boolean {
  if (agentId === 'amp') return /(^|[\s._-])amp($|[\s._-])/.test(key);
  return key.includes(agentId);
}

function safeFallbackLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) return null;
  return trimmed;
}

function displayableModelId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === 'default') return null;
  return trimmed;
}

function normalizeKey(raw: string): string {
  const basename = raw.trim().split(/[\\/]/).pop() ?? raw.trim();
  return basename
    .replace(/\.(cmd|exe|bat)$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
