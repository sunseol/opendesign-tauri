import {
  applyJsonInstall,
  removeJsonInstall,
  type CliInstallPlan,
  type JsonInstallPlan,
  type ManualInstallPlan,
} from './mcp-agent-install.js';

export interface McpInstallOutput {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface InstallResult {
  readonly ok: boolean;
  readonly agent: string;
  readonly kind?: 'cli' | 'json' | 'manual';
  readonly configPath?: string | null;
  readonly command?: string;
  readonly preview?: string;
  readonly format?: 'json' | 'yaml' | 'toml';
  readonly snippet?: string;
  readonly message: string;
}

export async function executeCliPlan(input: {
  readonly slug: string;
  readonly plan: CliInstallPlan;
  readonly uninstall: boolean;
  readonly dryRun: boolean;
  readonly useJson: boolean;
  readonly serverName: string;
  readonly output: McpInstallOutput;
  readonly spawnAgentCli: (bin: string, argv: readonly string[]) => Promise<number>;
}): Promise<number> {
  const argv = input.uninstall ? input.plan.removeArgv : input.plan.addArgv;
  if (input.dryRun) {
    emitInstallResult(
      input.useJson,
      {
        ok: true,
        agent: input.slug,
        kind: 'cli',
        command: `${input.plan.bin} ${argv.join(' ')}`,
        message: `would run: ${input.plan.bin} ${argv.join(' ')}`,
      },
      input.output,
    );
    return 0;
  }

  const code = await input.spawnAgentCli(input.plan.bin, argv);
  if (code !== 0) {
    emitInstallResult(
      input.useJson,
      {
        ok: false,
        agent: input.slug,
        kind: 'cli',
        message: `${input.plan.bin} exited with code ${code}`,
      },
      input.output,
    );
    return code || 1;
  }
  emitInstallResult(
    input.useJson,
    {
      ok: true,
      agent: input.slug,
      kind: 'cli',
      message: input.uninstall
        ? `removed ${input.serverName} from ${input.slug}`
        : `installed ${input.serverName} into ${input.slug}`,
    },
    input.output,
  );
  return 0;
}

export async function executeJsonPlan(input: {
  readonly slug: string;
  readonly plan: JsonInstallPlan;
  readonly uninstall: boolean;
  readonly dryRun: boolean;
  readonly useJson: boolean;
  readonly serverName: string;
  readonly output: McpInstallOutput;
  readonly readFile: (filePath: string) => Promise<string | null>;
  readonly writeFile: (filePath: string, text: string) => Promise<void>;
}): Promise<number> {
  const existing = await input.readFile(input.plan.configPath);
  if (input.uninstall) {
    return await executeJsonRemove(input, existing);
  }

  const next = applyJsonInstall(existing, input.plan);
  if (input.dryRun) {
    emitJsonPreview(input, next, `would write ${input.plan.configPath}`);
    return 0;
  }
  await input.writeFile(input.plan.configPath, next);
  emitInstallResult(
    input.useJson,
    {
      ok: true,
      agent: input.slug,
      kind: 'json',
      configPath: input.plan.configPath,
      message: `installed ${input.serverName} into ${input.plan.configPath}`,
    },
    input.output,
  );
  return 0;
}

export function emitManualPlan(
  useJson: boolean,
  slug: string,
  plan: ManualInstallPlan,
  output: McpInstallOutput,
): void {
  const result: InstallResult = {
    ok: false,
    agent: slug,
    kind: 'manual',
    configPath: plan.configPath,
    format: plan.format,
    snippet: plan.snippet,
    message: `${slug}: manual setup required. ${plan.reason}`,
  };
  if (useJson) {
    output.stdout(JSON.stringify(result));
    return;
  }
  output.stderr(`Manual setup required: ${result.message}`);
  if (plan.configPath != null) {
    output.stderr(`Config: ${plan.configPath}`);
  }
  output.stdout(plan.snippet);
}

export function emitInstallResult(
  useJson: boolean,
  result: InstallResult,
  output: McpInstallOutput,
): void {
  if (useJson) {
    output.stdout(JSON.stringify(result));
    return;
  }
  if (result.ok) {
    output.stdout(`OK: ${result.message}`);
    return;
  }
  output.stderr(`ERROR: ${result.message}`);
}

function emitJsonPreview(
  input: Parameters<typeof executeJsonPlan>[0],
  preview: string,
  message: string,
): void {
  emitInstallResult(
    input.useJson,
    {
      ok: true,
      agent: input.slug,
      kind: 'json',
      configPath: input.plan.configPath,
      preview,
      message,
    },
    input.output,
  );
}

async function executeJsonRemove(
  input: Parameters<typeof executeJsonPlan>[0],
  existing: string | null,
): Promise<number> {
  const next = removeJsonInstall(existing, input.plan);
  if (next == null) {
    emitInstallResult(
      input.useJson,
      {
        ok: true,
        agent: input.slug,
        kind: 'json',
        configPath: input.plan.configPath,
        message: `${input.serverName} not present in ${input.plan.configPath}; nothing to remove`,
      },
      input.output,
    );
    return 0;
  }
  if (input.dryRun) {
    emitJsonPreview(input, next, `would update ${input.plan.configPath}`);
    return 0;
  }
  await input.writeFile(input.plan.configPath, next);
  emitInstallResult(
    input.useJson,
    {
      ok: true,
      agent: input.slug,
      kind: 'json',
      configPath: input.plan.configPath,
      message: `removed ${input.serverName} from ${input.plan.configPath}`,
    },
    input.output,
  );
  return 0;
}
