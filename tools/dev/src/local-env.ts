import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const LOCAL_ENV_FILE_NAME = ".env.local";
export const LOCAL_DEVELOPMENT_TELEMETRY_ENV = "local_development";
export const TELEMETRY_ENV_KEY = "OD_TELEMETRY_ENV";

export type LoadWorkspaceLocalEnvResult = {
  readonly envPath: string;
  readonly loaded: boolean;
  readonly keys: readonly string[];
};

export function loadWorkspaceLocalEnv(options: {
  readonly workspaceRoot: string;
  readonly env?: NodeJS.ProcessEnv;
}): LoadWorkspaceLocalEnvResult {
  const env = options.env ?? process.env;
  const envPath = path.join(options.workspaceRoot, LOCAL_ENV_FILE_NAME);
  if (!existsSync(envPath)) return { envPath, loaded: false, keys: [] };

  const parsed = parseDotEnvLocal(readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    env[key] = value;
  }
  if (env[TELEMETRY_ENV_KEY] == null || env[TELEMETRY_ENV_KEY]?.trim() === "") {
    env[TELEMETRY_ENV_KEY] = LOCAL_DEVELOPMENT_TELEMETRY_ENV;
  }
  return { envPath, loaded: true, keys: Object.keys(parsed).sort() };
}

export function parseDotEnvLocal(content: string): Record<string, string> {
  const parsed: Record<string, string> = Object.create(null);
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const rawValue = normalized.slice(equalsIndex + 1).trim();
    parsed[key] = parseDotEnvValue(rawValue);
  }
  return parsed;
}

function parseDotEnvValue(rawValue: string): string {
  if (rawValue.startsWith("\"") || rawValue.startsWith("'")) {
    return parseQuotedValue(rawValue);
  }
  return stripInlineComment(rawValue).trim();
}

function parseQuotedValue(rawValue: string): string {
  const quote = rawValue.at(0);
  if (quote !== "\"" && quote !== "'") return stripInlineComment(rawValue).trim();

  let escaped = false;
  let value = "";
  for (const char of rawValue.slice(1)) {
    if (escaped) {
      value += quote === "\"" ? decodeEscape(char) : char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) return value;
    value += char;
  }
  return value;
}

function decodeEscape(char: string): string {
  if (char === "n") return "\n";
  if (char === "r") return "\r";
  if (char === "t") return "\t";
  return char;
}

function stripInlineComment(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "#") continue;
    const previous = value[index - 1];
    if (index === 0 || (previous != null && /\s/.test(previous))) return value.slice(0, index);
  }
  return value;
}
