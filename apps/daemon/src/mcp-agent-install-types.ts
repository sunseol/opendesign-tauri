export const AGENT_SLUGS = [
  'claude',
  'codex',
  'cursor',
  'copilot',
  'openclaw',
  'antigravity',
  'gemini',
  'pi',
  'vibe',
  'hermes',
  'cline',
  'kimi',
  'trae',
  'opencode',
] as const;

export type AgentSlug = (typeof AGENT_SLUGS)[number];

const AGENT_SLUG_SET: ReadonlySet<string> = new Set(AGENT_SLUGS);

export function isAgentSlug(value: string): value is AgentSlug {
  return AGENT_SLUG_SET.has(value);
}

export interface McpLaunchSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string>;
}

export interface PlanContext {
  readonly home: string;
  readonly platform: NodeJS.Platform;
  readonly serverName: string;
}

export interface CliInstallPlan {
  readonly kind: 'cli';
  readonly slug: AgentSlug;
  readonly bin: string;
  readonly addArgv: readonly string[];
  readonly removeArgv: readonly string[];
  readonly getArgv: readonly string[];
}

export interface JsonInstallPlan {
  readonly kind: 'json';
  readonly slug: AgentSlug;
  readonly configPath: string;
  readonly keyPath: readonly string[];
  readonly serverKey: string;
  readonly entry: unknown;
}

export interface ManualInstallPlan {
  readonly kind: 'manual';
  readonly slug: AgentSlug;
  readonly format: 'json' | 'yaml' | 'toml';
  readonly configPath: string | null;
  readonly snippet: string;
  readonly reason: string;
}

export type InstallPlan = CliInstallPlan | JsonInstallPlan | ManualInstallPlan;
