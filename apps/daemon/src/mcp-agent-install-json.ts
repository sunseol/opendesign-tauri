import type { JsonInstallPlan } from './mcp-agent-install-types.js';

type JsonObject = Record<string, unknown>;

export function applyJsonInstall(existingText: string | null, plan: JsonInstallPlan): string {
  const root = parseJsonObject(existingText, plan.configPath);
  let cursor: JsonObject = root;
  for (const key of plan.keyPath) {
    const next = cursor[key];
    if (isJsonObject(next)) {
      cursor = next;
      continue;
    }
    const created: JsonObject = {};
    cursor[key] = created;
    cursor = created;
  }
  cursor[plan.serverKey] = plan.entry;
  return `${JSON.stringify(root, null, 2)}\n`;
}

export function removeJsonInstall(existingText: string | null, plan: JsonInstallPlan): string | null {
  if (existingText == null || existingText.trim() === '') {
    return null;
  }

  const root = parseJsonObject(existingText, plan.configPath);
  let cursor: JsonObject = root;
  for (const key of plan.keyPath) {
    const next = cursor[key];
    if (!isJsonObject(next)) {
      return null;
    }
    cursor = next;
  }
  if (!(plan.serverKey in cursor)) {
    return null;
  }

  delete cursor[plan.serverKey];
  return `${JSON.stringify(root, null, 2)}\n`;
}

function parseJsonObject(text: string | null, where: string): JsonObject {
  if (text == null || text.trim() === '') {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`existing config at ${where} is not valid JSON: ${message}`);
  }
  if (!isJsonObject(parsed)) {
    throw new Error(`existing config at ${where} is not a JSON object`);
  }
  return parsed;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
