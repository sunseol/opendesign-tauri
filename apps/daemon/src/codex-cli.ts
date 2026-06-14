import { spawn } from 'node:child_process';

export interface CodexRunnerResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CodexRunnerOptions {
  readonly env?: Record<string, string>;
}

export interface CodexRunner {
  run(args: readonly string[], opts?: CodexRunnerOptions): Promise<CodexRunnerResult>;
}

const CODEX_TIMEOUT_MS = 30_000;

const defaultCodexRunner: CodexRunner = {
  run(args, opts) {
    return new Promise<CodexRunnerResult>((resolve, reject) => {
      const child = spawn('codex', [...args], {
        env: { ...process.env, ...(opts?.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`codex CLI timed out after ${CODEX_TIMEOUT_MS / 1000}s`));
      }, CODEX_TIMEOUT_MS);

      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? -1, stdout, stderr });
      });
    });
  },
};

let testRunner: CodexRunner | null = null;

export function setCodexRunner(runner: CodexRunner | null): void {
  testRunner = runner;
}

function activeRunner(): CodexRunner {
  return testRunner ?? defaultCodexRunner;
}

export interface CodexInstallStatus {
  readonly available: boolean;
  readonly installed: boolean;
}

export async function probeCodexInstall(name: string): Promise<CodexInstallStatus> {
  try {
    const result = await activeRunner().run(['mcp', 'get', name]);
    return { available: true, installed: result.exitCode === 0 };
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return { available: false, installed: false };
    }
    throw error;
  }
}

export interface CodexInstallSpec {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string>;
}

export async function installCodexMcp(spec: CodexInstallSpec): Promise<void> {
  const argv: string[] = ['mcp', 'add', spec.name];
  for (const [key, value] of Object.entries(spec.env)) {
    argv.push('--env', `${key}=${value}`);
  }
  argv.push('--', spec.command, ...spec.args);

  const result = await activeRunner().run(argv);
  if (result.exitCode !== 0) {
    throw new Error(`codex mcp add failed: ${failureDetail(result)}`);
  }
}

export async function uninstallCodexMcp(name: string): Promise<void> {
  const result = await activeRunner().run(['mcp', 'remove', name]);
  if (result.exitCode !== 0) {
    throw new Error(`codex mcp remove failed: ${failureDetail(result)}`);
  }
}

function failureDetail(result: CodexRunnerResult): string {
  return result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
