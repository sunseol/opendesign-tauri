import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(toolRoot, fileName), "utf8")) as T;
}

describe("tools-pack build metadata", () => {
  it("declares metatool build inputs including package resources", () => {
    const manifest = readJson<{ scripts: { build: string } }>("package.json");
    const meta = readJson<{
      readonly buildCommand: string;
      readonly distEntries: readonly string[];
      readonly inputs: readonly string[];
      readonly packageName: string;
      readonly toolName: string;
    }>("meta.json");

    expect(meta).toEqual({
      toolName: "tools-pack",
      packageName: "@open-design/tools-pack",
      buildCommand: "pnpm --filter @open-design/tools-pack build",
      distEntries: ["dist/index.mjs"],
      inputs: ["src", "resources", "meta.json", "package.json", "esbuild.config.mjs", "tsconfig.json"],
    });
    expect(manifest.scripts.build).toContain("metatool/src/cli.ts write .");
  });

  it("checks metatool freshness before loading dist", () => {
    const bin = readFileSync(join(toolRoot, "bin", "tools-pack.mjs"), "utf8");

    expect(bin).toContain("assertFreshToolBuildFromMeta");
    expect(bin).not.toContain("statSync");
    expect(bin).not.toContain("isStale");
  });
});
