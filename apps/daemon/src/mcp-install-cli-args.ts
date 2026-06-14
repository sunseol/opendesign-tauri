import { AGENT_SLUGS } from './mcp-agent-install.js';

const STRING_FLAGS = new Set(['daemon-url', 'name']);
const BOOLEAN_FLAGS = new Set(['help', 'h', 'json', 'print', 'dry-run', 'uninstall', 'remove']);

export interface ParsedMcpInstallArgs {
  readonly flags: Record<string, string | true>;
  readonly positionals: readonly string[];
}

export function parseMcpInstallArgs(args: readonly string[]): ParsedMcpInstallArgs {
  const flags: Record<string, string | true> = {};
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg == null) {
      continue;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    if (!STRING_FLAGS.has(key) && !BOOLEAN_FLAGS.has(key)) {
      throw new Error(`unknown flag: --${key}. Run with --help for the list of accepted flags.`);
    }
    if (eq >= 0) {
      flags[key] = arg.slice(eq + 1);
      continue;
    }
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    const value = args[index + 1];
    if (value == null) {
      throw new Error(`flag --${key} requires a value`);
    }
    flags[key] = value;
    index += 1;
  }
  return { flags, positionals };
}

export function flagString(flags: Record<string, string | true>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

export function flagBool(flags: Record<string, string | true>, key: string): boolean {
  return flags[key] === true;
}

export function mcpInstallHelp(): string {
  return `Usage: od mcp install <agent> [options]

Register Open Design's stdio MCP server into a coding agent's own config.

Agents:
  ${AGENT_SLUGS.join(' ')}

Options:
  --uninstall, --remove   Remove the Open Design MCP server instead.
  --print, --dry-run      Show what would change; write nothing.
  --json                  Machine-readable result.
  --name <name>           MCP server name in the agent config (default: open-design).
  --daemon-url <url>      Daemon URL used to resolve the launch command.

The launch command is resolved from the running daemon's /api/mcp/install-info.
If the daemon is unreachable, a minimal od mcp --daemon-url entry is printed.`;
}
