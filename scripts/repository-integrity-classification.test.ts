import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const classificationPath = "docs/repository-integrity-script-classification.md";

const retainedMigrationScripts = [
  "scripts/advance-tauri-migration-m4-m5.ts",
  "scripts/apply-tauri-migration-m5.ts",
  "scripts/continue-tauri-migration.ts",
  "scripts/create-tauri-migration-bundle.ts",
  "scripts/download-tauri-m4-reports.ts",
  "scripts/import-tauri-migration-bundle.ts",
  "scripts/package-tauri-migration-handoff.ts",
  "scripts/push-tauri-migration-handoff.ts",
  "scripts/tauri-ci-scope.test.ts",
  "scripts/tauri-migration-command-sidecar.ts",
  "scripts/tauri-migration-inventory.ts",
  "scripts/tauri-migration-policy.ts",
  "scripts/tauri-migration-pr-body.ts",
  "scripts/tauri-migration-status.ts",
  "scripts/verify-tauri-migration-handoff.ts",
  "scripts/verify-tauri-migration-remote.ts",
  "scripts/verify-tauri-platform-gates.ts",
] as const;

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("repository integrity classification covers retained migration scripts", () => {
  const doc = readText(classificationPath);

  for (const scriptPath of retainedMigrationScripts) {
    assert.match(doc, new RegExp(`\\\`${scriptPath}\\\``), `${scriptPath} needs a classification entry`);
  }

  assert.match(doc, /Retained until M6 cleanup/);
  assert.match(doc, /Retirement condition/);
});

test("repository integrity classification names deferred Nix split-hash work", () => {
  const doc = readText(classificationPath);

  for (const token of [
    "nix/package-daemon.nix",
    "nix/package-web.nix",
    "daemonHash",
    "webHash",
    "Nix-capable environment",
  ]) {
    assert.match(doc, new RegExp(token.replaceAll("/", "\\/")));
  }
});

test("guard runs repository integrity classification checks", () => {
  const manifest = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
  assert.match(manifest.scripts?.guard ?? "", /scripts\/repository-integrity-classification\.test\.ts/);
});
