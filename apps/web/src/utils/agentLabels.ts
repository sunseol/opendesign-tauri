const AGENT_LABELS: Record<string, string> = {
  amp: 'Amp',
  claude: 'Claude',
  codebuddy: 'Codebuddy',
  codex: 'Codex',
  devin: 'Devin',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  'cursor-agent': 'Cursor',
  cursor: 'Cursor',
  qwen: 'Qwen',
  qoder: 'Qoder',
  copilot: 'Copilot',
  deepseek: 'DeepSeek',
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
