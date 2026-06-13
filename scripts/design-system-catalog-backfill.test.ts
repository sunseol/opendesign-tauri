import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const designSystemsRoot = path.join(repoRoot, "design-systems");

const requiredBackfillFiles = [
  "USAGE.md",
  "components.manifest.json",
  "design-tokens.json",
  "manifest.json",
  "preview/colors.html",
  "preview/spacing.html",
  "preview/typography.html",
  "source/evidence.md",
  "source/token-contract.report.json",
  "source/tokens.source.json",
  "tailwind-v4.css",
] as const;

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function designSystemIds(): Promise<string[]> {
  const entries = await readdir(designSystemsRoot, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    if (await exists(path.join(designSystemsRoot, entry.name, "DESIGN.md"))) {
      ids.push(entry.name);
    }
  }
  return ids.sort();
}

test("official design-system catalog has full 2.0 backfill outputs", async () => {
  const ids = await designSystemIds();
  assert.equal(ids.length, 150);

  const missing: string[] = [];
  for (const id of ids) {
    for (const relativeFile of requiredBackfillFiles) {
      const filePath = path.join(designSystemsRoot, id, relativeFile);
      if (!(await exists(filePath))) {
        missing.push(`${id}/${relativeFile}`);
      }
    }
  }

  assert.equal(
    missing.length,
    0,
    `missing ${missing.length} design-system backfill files; first entries: ${missing.slice(0, 20).join(", ")}`,
  );
});
