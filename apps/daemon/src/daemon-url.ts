import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SIDECAR_ENV,
  SIDECAR_MESSAGES,
  type DaemonStatusSnapshot,
} from "@open-design/sidecar-proto";
import { requestJsonIpc } from "@open-design/sidecar";

export const DEFAULT_DAEMON_URL = "http://127.0.0.1:7456";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export interface ResolveDaemonUrlOptions {
  /** Value passed via `--daemon-url`. Empty string is treated as unset. */
  flagUrl?: string | null;
  /** Defaults to `process.env`; injected for tests. */
  env?: NodeJS.ProcessEnv;
  /** IPC discovery timeout. Short by default so an absent daemon does not stall CLI startup. */
  timeoutMs?: number;
}

/**
 * Resolve the daemon HTTP base URL for `od` client commands.
 *
 * Spawn order: explicit `--daemon-url` flag, `OD_DAEMON_URL` env, then
 * a STATUS roundtrip to the concrete sidecar IPC endpoint supplied by
 * the lifecycle owner in `OD_SIDECAR_IPC_PATH`, then the default
 * `tools-dev status --json` runtime. Falls back to the legacy default
 * for direct `od` launches that do not run as a sidecar.
 */
export async function resolveDaemonUrl(
  options: ResolveDaemonUrlOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const flagUrl = options.flagUrl ?? null;
  if (flagUrl != null && flagUrl.length > 0) return flagUrl;
  const envUrl = env.OD_DAEMON_URL;
  if (envUrl != null && envUrl.length > 0) return envUrl;
  const discovered = await discoverDaemonUrlFromIpc(env, options.timeoutMs ?? 800);
  if (discovered != null) return discovered;
  const toolsDevUrl = await discoverDaemonUrlFromToolsDev(env, options.timeoutMs ?? 800);
  if (toolsDevUrl != null) return toolsDevUrl;
  return DEFAULT_DAEMON_URL;
}

async function discoverDaemonUrlFromIpc(
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<string | null> {
  const socketPath = env[SIDECAR_ENV.IPC_PATH];
  if (socketPath == null || socketPath.length === 0) return null;
  try {
    const status = await requestJsonIpc<DaemonStatusSnapshot>(
      socketPath,
      { type: SIDECAR_MESSAGES.STATUS },
      { timeoutMs },
    );
    return status?.url ?? null;
  } catch {
    return null;
  }
}

async function discoverDaemonUrlFromToolsDev(
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<string | null> {
  return await new Promise<string | null>((resolveUrl) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("pnpm", ["--silent", "exec", "tools-dev", "status", "--json"], {
        cwd: REPO_ROOT,
        env,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      resolveUrl(null);
      return;
    }

    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const done = (url: string | null) => {
      if (settled) return;
      settled = true;
      if (timer != null) clearTimeout(timer);
      resolveUrl(url);
    };
    timer = setTimeout(() => {
      child.kill();
      done(null);
    }, timeoutMs);

    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.on("error", () => done(null));
    child.on("close", (code) => {
      done(code === 0 ? extractDaemonUrlFromToolsDevStatus(stdout) : null);
    });
  });
}

function extractDaemonUrlFromToolsDevStatus(stdout: string): string | null {
  for (let i = stdout.indexOf("{"); i !== -1; i = stdout.indexOf("{", i + 1)) {
    try {
      const url = readToolsDevStatusUrl(JSON.parse(stdout.slice(i)));
      if (url != null) return url;
    } catch {
      continue;
    }
  }
  return null;
}

function readToolsDevStatusUrl(status: unknown): string | null {
  if (!isRecord(status)) return null;
  const rootUrl = cleanUrl(status.url);
  const apps = status.apps;
  if (!isRecord(apps)) return rootUrl;
  const daemon = apps.daemon;
  if (!isRecord(daemon)) return rootUrl;
  return cleanUrl(daemon.url) ?? rootUrl;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function cleanUrl(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
