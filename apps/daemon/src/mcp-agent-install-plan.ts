import path from 'node:path';
import { genericMcpServersSnippet, hermesYamlSnippet, vibeTomlSnippet } from './mcp-agent-install-snippets.js';
import type { AgentSlug, InstallPlan, McpLaunchSpec, PlanContext } from './mcp-agent-install-types.js';

type JsonObject = Record<string, unknown>;

export function planAgentInstall(
  slug: AgentSlug,
  spec: McpLaunchSpec,
  ctx: PlanContext,
): InstallPlan {
  const { home, platform, serverName } = ctx;

  switch (slug) {
    case 'claude':
      return cliPlan(slug, 'claude', [
        'mcp',
        'add',
        '--scope',
        'user',
        serverName,
        ...envFlags(spec.env, '-e'),
        '--',
        spec.command,
        ...spec.args,
      ], ['mcp', 'remove', '--scope', 'user', serverName], ['mcp', 'get', serverName]);
    case 'codex':
      return cliPlan(slug, 'codex', [
        'mcp',
        'add',
        serverName,
        ...envFlags(spec.env, '--env'),
        '--',
        spec.command,
        ...spec.args,
      ], ['mcp', 'remove', serverName], ['mcp', 'get', serverName]);
    case 'gemini':
      return cliPlan(slug, 'gemini', [
        'mcp',
        'add',
        '-s',
        'user',
        '-t',
        'stdio',
        ...envFlags(spec.env, '-e'),
        serverName,
        spec.command,
        ...spec.args,
      ], ['mcp', 'remove', serverName], ['mcp', 'list']);
    case 'kimi':
      return cliPlan(slug, 'kimi', [
        'mcp',
        'add',
        '--transport',
        'stdio',
        ...envFlags(spec.env, '--env'),
        serverName,
        '--',
        spec.command,
        ...spec.args,
      ], ['mcp', 'remove', serverName], ['mcp', 'get', serverName]);
    case 'cursor':
      return jsonPlan(slug, path.join(home, '.cursor', 'mcp.json'), ['mcpServers'], serverName, jsonEntry(spec, { type: 'stdio' }));
    case 'copilot':
      return jsonPlan(slug, path.join(home, '.copilot', 'mcp-config.json'), ['mcpServers'], serverName, jsonEntry(spec, { type: 'local', tools: ['*'] }));
    case 'cline':
      return jsonPlan(slug, clineConfigPath(home, platform), ['mcpServers'], serverName, jsonEntry(spec, { disabled: false, autoApprove: [] }));
    case 'opencode':
      return jsonPlan(slug, path.join(home, '.config', 'opencode', 'opencode.json'), ['mcp'], serverName, opencodeEntry(spec));
    case 'openclaw':
      return jsonPlan(slug, path.join(home, '.openclaw', 'openclaw.json'), ['mcp', 'servers'], serverName, jsonEntry(spec));
    case 'antigravity':
      return jsonPlan(slug, path.join(home, '.gemini', 'antigravity', 'mcp_config.json'), ['mcpServers'], serverName, jsonEntry(spec));
    case 'trae':
      return jsonPlan(slug, traeConfigPath(home, platform), ['mcpServers'], serverName, jsonEntry(spec));
    case 'vibe':
      return {
        kind: 'manual',
        slug,
        format: 'toml',
        configPath: path.join(home, '.vibe', 'config.toml'),
        snippet: vibeTomlSnippet(spec, serverName),
        reason:
          'Mistral Vibe uses a TOML array-of-tables ([[mcp_servers]]); its exact schema is unverified, so append this block by hand to avoid corrupting an existing config.',
      };
    case 'pi':
      return {
        kind: 'manual',
        slug,
        format: 'json',
        configPath: path.join(home, '.pi', 'agent', 'mcp.json'),
        snippet: genericMcpServersSnippet(spec, serverName),
        reason:
          'The pi coding agent exposes MCP, but its config path/schema is not authoritatively documented. Paste this into pi MCP config after checking pi --help for the exact location.',
      };
    case 'hermes':
      return {
        kind: 'manual',
        slug,
        format: 'yaml',
        configPath: path.join(home, '.hermes', 'config.yaml'),
        snippet: hermesYamlSnippet(spec, serverName),
        reason:
          'Hermes config format is unverified. Add this under your Hermes MCP server configuration by hand.',
      };
  }
}

function cliPlan(
  slug: AgentSlug,
  bin: string,
  addArgv: readonly string[],
  removeArgv: readonly string[],
  getArgv: readonly string[],
): InstallPlan {
  return { kind: 'cli', slug, bin, addArgv, removeArgv, getArgv };
}

function jsonPlan(
  slug: AgentSlug,
  configPath: string,
  keyPath: readonly string[],
  serverKey: string,
  entry: JsonObject,
): InstallPlan {
  return { kind: 'json', slug, configPath, keyPath, serverKey, entry };
}

function envFlags(env: Record<string, string>, flag: string): string[] {
  const flags: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    flags.push(flag, `${key}=${value}`);
  }
  return flags;
}

function jsonEntry(
  spec: McpLaunchSpec,
  extra: JsonObject = {},
  envKey: 'env' | 'environment' = 'env',
): JsonObject {
  const entry: JsonObject = {
    command: spec.command,
    args: spec.args,
    ...extra,
  };
  if (Object.keys(spec.env).length > 0) {
    entry[envKey] = spec.env;
  }
  return entry;
}

function opencodeEntry(spec: McpLaunchSpec): JsonObject {
  const entry: JsonObject = {
    type: 'local',
    command: [spec.command, ...spec.args],
    enabled: true,
  };
  if (Object.keys(spec.env).length > 0) {
    entry.environment = spec.env;
  }
  return entry;
}

function clineConfigPath(home: string, platform: NodeJS.Platform): string {
  const rel = path.join(
    'globalStorage',
    'saoudrizwan.claude-dev',
    'settings',
    'cline_mcp_settings.json',
  );
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', rel);
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User', rel);
  }
  return path.join(home, '.config', 'Code', 'User', rel);
}

function traeConfigPath(home: string, platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Trae', 'User', 'mcp.json');
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Trae', 'User', 'mcp.json');
  }
  return path.join(home, '.config', 'Trae', 'User', 'mcp.json');
}
