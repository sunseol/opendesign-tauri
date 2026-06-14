import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

const remotePreviewIds = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertString(value: unknown, message: string): asserts value is string {
  assert.equal(typeof value, "string", message);
}

function assertNumber(value: unknown, message: string): asserts value is number {
  assert.equal(typeof value, "number", message);
}

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function collectPluginNames(directory: string): Promise<Set<string>> {
  const names = new Set<string>();

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== "open-design.json") continue;
      const raw = await readJson(path.relative(repoRoot, entryPath));
      assert.ok(isRecord(raw), `${entryPath} must be a JSON object`);
      const name = raw.name;
      assertString(name, `${entryPath} must declare name`);
      names.add(name);
    }
  }

  await walk(path.join(repoRoot, directory));
  return names;
}

test("curated contributor events and cards stay internally linked", async () => {
  const raw = await readJson("data/contributors.json");
  assert.ok(isRecord(raw), "contributors.json must be an object");
  assert.ok(isRecord(raw.contributors), "contributors must be an object");

  const contributorEntries = Object.entries(raw.contributors);
  const totalContributors = raw.totalContributors;
  assertNumber(totalContributors, "contributors total must be a number");
  assert.equal(totalContributors, contributorEntries.length);

  const cardFiles = await readdir(path.join(repoRoot, "data", "cards"));
  for (const [username, value] of contributorEntries) {
    assert.ok(isRecord(value), `${username} contributor entry must be an object`);
    assert.equal(value.username, username);
    const tier = value.tier;
    assertString(tier, `${username} must have a tier`);
    assert.ok(
      cardFiles.some((file) => file.startsWith(`${username}-${tier}-`) && file.endsWith(".svg")),
      `${username} must have a matching card SVG`,
    );
  }

  const events: unknown[] = (await readFile(path.join(repoRoot, "data", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
  assert.ok(events.length > 0, "events.jsonl must contain at least one event");
  for (const event of events) {
    assert.ok(isRecord(event), "event line must be an object");
    const user = event.user;
    assertString(user, "event must declare user");
    assert.ok(user in raw.contributors, `event user ${user} must exist in contributors`);
  }
});

test("plugin preview manifest entries resolve to plugins or documented remote previews", async () => {
  const raw = await readJson("data/plugin-previews/manifest.json");
  assert.ok(isRecord(raw), "plugin preview manifest must be an object");
  assert.ok(isRecord(raw.previews), "plugin preview manifest must contain previews");

  const pluginNames = new Set([
    ...(await collectPluginNames("plugins/_official")),
    ...(await collectPluginNames("plugins/community")),
  ]);
  const missing = [];

  for (const [id, value] of Object.entries(raw.previews)) {
    assert.ok(isRecord(value), `${id} preview must be an object`);
    assert.match(String(value.hash), /^[a-f0-9]{16}$/);
    assert.equal(value.video, `${id}.${value.hash}.mp4`);
    assert.equal(value.poster, `${id}.${value.hash}.poster.jpg`);
    const durationMs = value.durationMs;
    const holdMs = value.holdMs;
    assertNumber(durationMs, `${id} durationMs must be a number`);
    assert.ok(durationMs > 0, `${id} durationMs must be positive`);
    assertNumber(holdMs, `${id} holdMs must be a number`);
    assert.ok(holdMs >= 0, `${id} holdMs must be non-negative`);
    if (!pluginNames.has(id)) missing.push(id);
  }

  assert.deepEqual(missing.sort(), [...remotePreviewIds].sort());
});
