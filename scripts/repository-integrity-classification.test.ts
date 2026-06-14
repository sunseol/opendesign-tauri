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

test("repository integrity classification records #36 governance workflow decisions", () => {
  const doc = readText(classificationPath);

  for (const token of [
    ".github/workflows/fork-pr-workflow-approval.yml",
    ".github/workflows/actionlint.yml",
    ".github/workflows/agent-pr-explore-sandbox.yml",
    "AGENT_PR_EXPLORE_ENABLED",
    ".github/actions/setup-workspace",
    ".github/actions/setup-playwright",
    ".github/workflows/ci.yml",
    "merge_group",
    ".github/workflows/ci-gate.yml",
    ".github/workflows/ci-hosted.yml",
    ".github/workflows/ci-runner.yml",
    ".github/workflows/notify-daily-feishu.yml",
    ".github/workflows/notify-release-feishu.yml",
    "registry.npmmirror.com",
  ]) {
    assert.match(doc, new RegExp(escapeRegExp(token)), `${token} needs a #36 classification entry`);
  }

  assert.match(doc, /Classified but not copied verbatim/);
  assert.match(doc, /Tauri packaged-smoke requirements/);
});

test("guard runs repository integrity classification checks", () => {
  const manifest = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
  assert.match(manifest.scripts?.guard ?? "", /scripts\/repository-integrity-classification\.test\.ts/);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
