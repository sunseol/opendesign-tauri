import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(toolRoot, fileName), "utf8")) as T;
}

test("tools-dev declares metatool build metadata", () => {
  const manifest = readJson<{ scripts: { build: string } }>("package.json");
  const meta = readJson<{
    buildCommand: string;
    distEntries: string[];
    inputs: string[];
    packageName: string;
    toolName: string;
  }>("meta.json");

  assert.equal(meta.toolName, "tools-dev");
  assert.equal(meta.packageName, "@open-design/tools-dev");
  assert.equal(meta.buildCommand, "pnpm --filter @open-design/tools-dev build");
  assert.deepEqual(meta.distEntries, ["dist/index.mjs"]);
  assert.deepEqual(meta.inputs, ["src", "meta.json", "package.json", "esbuild.config.mjs", "tsconfig.json"]);
  assert.match(manifest.scripts.build, /metatool\/src\/cli\.ts write \./);
});

test("tools-dev bin checks metatool freshness before loading dist", () => {
  const bin = readFileSync(join(toolRoot, "bin", "tools-dev.mjs"), "utf8");

  assert.match(bin, /assertFreshToolBuildFromMeta/);
  assert.doesNotMatch(bin, /existsSync/);
});
