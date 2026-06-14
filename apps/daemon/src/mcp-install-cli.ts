import os from 'node:os';
import { resolveDaemonUrl } from './daemon-url.js';
import { flagBool, flagString, mcpInstallHelp, parseMcpInstallArgs } from './mcp-install-cli-args.js';
import { emitInstallResult, emitManualPlan, executeCliPlan, executeJsonPlan } from './mcp-install-cli-exec.js';
import { readTextFileOrNull, spawnAgentCli, writeTextFile } from './mcp-install-cli-io.js';
import { AGENT_SLUGS, isAgentSlug, planAgentInstall, type McpLaunchSpec } from './mcp-agent-install.js';

export interface McpInstallCliDeps {
  readonly fetchImpl?: typeof fetch;
  readonly home?: string;
  readonly platform?: NodeJS.Platform;
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
  readonly spawnAgentCli?: (bin: string, argv: readonly string[]) => Promise<number>;
  readonly readFile?: (filePath: string) => Promise<string | null>;
  readonly writeFile?: (filePath: string, text: string) => Promise<void>;
}

interface InstallInfoPayload {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string>;
}

export { mcpInstallHelp } from './mcp-install-cli-args.js';

export async function runMcpInstallCli(
  args: readonly string[],
  deps: McpInstallCliDeps = {},
): Promise<number> {
  const output = {
    stdout: deps.stdout ?? ((text: string) => console.log(text)),
    stderr: deps.stderr ?? ((text: string) => console.error(text)),
  };
  let parsed;
  try {
    parsed = parseMcpInstallArgs(args);
  } catch (error) {
    output.stderr(error instanceof Error ? error.message : String(error));
    output.stdout(mcpInstallHelp());
    return 2;
  }

  if (flagBool(parsed.flags, 'help') || flagBool(parsed.flags, 'h')) {
    output.stdout(mcpInstallHelp());
    return 0;
  }

  const slug = parsed.positionals[0];
  const useJson = flagBool(parsed.flags, 'json');
  if (slug == null) {
    output.stderr('missing agent slug');
    output.stdout(mcpInstallHelp());
    return 2;
  }
  if (!isAgentSlug(slug)) {
    emitInstallResult(useJson, { ok: false, agent: slug, message: unknownAgentMessage(slug) }, output);
    return 2;
  }

  const serverName = flagString(parsed.flags, 'name') ?? 'open-design';
  const spec = await resolveMcpLaunchSpec(parsed.flags, deps.fetchImpl ?? fetch);
  const plan = planAgentInstall(slug, spec, {
    home: deps.home ?? os.homedir(),
    platform: deps.platform ?? process.platform,
    serverName,
  });
  const uninstall = flagBool(parsed.flags, 'uninstall') || flagBool(parsed.flags, 'remove');
  const dryRun = flagBool(parsed.flags, 'print') || flagBool(parsed.flags, 'dry-run');

  if (plan.kind === 'manual') {
    emitManualPlan(useJson, slug, plan, output);
    return 0;
  }
  if (plan.kind === 'cli') {
    return await executeCliPlan({
      slug,
      plan,
      uninstall,
      dryRun,
      useJson,
      serverName,
      output,
      spawnAgentCli: deps.spawnAgentCli ?? spawnAgentCli,
    });
  }
  return await executeJsonPlan({
    slug,
    plan,
    uninstall,
    dryRun,
    useJson,
    serverName,
    output,
    readFile: deps.readFile ?? readTextFileOrNull,
    writeFile: deps.writeFile ?? writeTextFile,
  });
}

async function resolveMcpLaunchSpec(
  flags: Record<string, string | true>,
  fetchImpl: typeof fetch,
): Promise<McpLaunchSpec> {
  const base = (await resolveDaemonUrl({ flagUrl: flagString(flags, 'daemon-url') ?? null })).replace(/\/$/u, '');
  try {
    const response = await fetchImpl(`${base}/api/mcp/install-info`);
    if (response.ok) {
      const payload: unknown = await response.json();
      if (isInstallInfoPayload(payload)) {
        return payload;
      }
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
  }
  return {
    command: 'od',
    args: ['mcp', '--daemon-url', base],
    env: {},
  };
}

function isInstallInfoPayload(value: unknown): value is InstallInfoPayload {
  if (!isRecord(value)) {
    return false;
  }
  const command = value.command;
  const args = value.args;
  const env = value.env;
  return (
    typeof command === 'string' &&
    Array.isArray(args) &&
    args.every((item) => typeof item === 'string') &&
    isStringRecord(env)
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function unknownAgentMessage(slug: string): string {
  return `unknown agent: ${slug} (expected one of: ${AGENT_SLUGS.join(' ')})`;
}
