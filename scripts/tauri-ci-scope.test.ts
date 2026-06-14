import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const ciWorkflowPath = join(repoRoot, ".github", "workflows", "ci.yml");
const nixAutofixWorkflowPath = join(repoRoot, ".github", "workflows", "nix-hash-autofix.yml");
const nixReadmePath = join(repoRoot, "nix", "README.md");
const agentExploreWorkflowPath = join(repoRoot, ".github", "workflows", "agent-pr-explore-sandbox.yml");
const agentExploreScriptPath = join(repoRoot, ".github", "scripts", "agent-pr-explore-sandbox.sh");

const tauriEvidencePaths = [
  "scripts/advance-tauri-migration-m4-m5.ts",
  "scripts/advance-tauri-migration-m4-m5.test.ts",
  "scripts/apply-tauri-migration-m5.ts",
  "scripts/apply-tauri-migration-m5.test.ts",
  "scripts/continue-tauri-migration.ts",
  "scripts/create-tauri-migration-bundle.ts",
  "scripts/create-tauri-migration-bundle.test.ts",
  "scripts/download-tauri-m4-reports.ts",
  "scripts/download-tauri-m4-reports.test.ts",
  "scripts/import-tauri-migration-bundle.ts",
  "scripts/import-tauri-migration-bundle.test.ts",
  "scripts/package-tauri-migration-handoff.ts",
  "scripts/package-tauri-migration-handoff.test.ts",
  "scripts/push-tauri-migration-handoff.ts",
  "scripts/push-tauri-migration-handoff.test.ts",
  "scripts/tauri-migration-inventory.ts",
  "scripts/tauri-migration-inventory.test.ts",
  "scripts/tauri-migration-policy.ts",
  "scripts/tauri-migration-policy.test.ts",
  "scripts/tauri-migration-status.ts",
  "scripts/tauri-migration-status.test.ts",
  "scripts/verify-tauri-migration-handoff.ts",
  "scripts/verify-tauri-migration-handoff.test.ts",
  "scripts/verify-tauri-migration-remote.ts",
  "scripts/verify-tauri-migration-remote.test.ts",
  "scripts/verify-tauri-platform-gates.ts",
  "scripts/verify-tauri-platform-gates.test.ts",
] as const;

test("Tauri migration evidence scripts trigger package smoke and tools-pack tests", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");
  const tauriSmokeScope = workflow.match(
    /if \[\[ "\$file" == "e2e\/lib\/vitest\/packaged-report\.ts"[\s\S]*?\]\]; then\n\s+tools_pack_tests_required=true\n\s+tauri_smoke_required=true/,
  )?.[0];
  assert.ok(tauriSmokeScope, "ci.yml must define the explicit Tauri smoke/tools-pack condition");

  for (const filePath of tauriEvidencePaths) {
    assert.match(tauriSmokeScope, quotedPathPattern(filePath), `${filePath} must require tools-pack and Tauri smoke`);
  }
});

test("Tauri migration handoff can manually dispatch native CI", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");

  assert.match(workflow, /^\s+workflow_dispatch:\s*$/m, "ci.yml must keep workflow_dispatch for handoff CI runs");
  assert.match(
    workflow,
    /else\n\s+daemon_tests_required=true\n\s+web_tests_required=true\n\s+tools_dev_tests_required=true\n\s+tools_pack_tests_required=true\n\s+tauri_smoke_required=true\n\s+workspace_validation_required=true\n\s+fi/m,
    "workflow_dispatch must force the packaged scope so Windows/Linux Tauri smoke jobs run",
  );
  assert.match(workflow, /^\s+packaged_smoke_tauri_win:\s*$/m, "ci.yml must define the Windows Tauri smoke job");
  assert.match(workflow, /^\s+packaged_smoke_tauri_linux:\s*$/m, "ci.yml must define the Linux Tauri smoke job");
  assert.match(
    workflow,
    /^\s+if: \$\{\{ needs\.change_scopes\.outputs\.tauri_smoke_required == 'true' \}\}\s*$/m,
    "Tauri smoke jobs must remain tied to tauri_smoke_required",
  );
});

test("main CI reuses cached setup actions for Ubuntu validation jobs", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");

  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-workspace/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-playwright/);
  assert.match(workflow, /package-json-path: e2e\/package\.json/);
  assert.match(workflow, /install-command: pnpm -C e2e exec playwright install --with-deps chromium/);

  const ubuntuValidationRegion = workflow.match(
    /preflight:[\s\S]*?\n\n  packaged_smoke_tauri_win:/,
  )?.[0];
  assert.ok(ubuntuValidationRegion, "ci.yml must keep the Ubuntu validation region before packaged smoke jobs");
  assert.doesNotMatch(ubuntuValidationRegion, /Resolve pnpm store path/);
  assert.doesNotMatch(ubuntuValidationRegion, /Restore pnpm store cache/);
  assert.doesNotMatch(ubuntuValidationRegion, /Resolve Playwright version/);
  assert.doesNotMatch(ubuntuValidationRegion, /Restore Playwright browser cache/);
});

test("Nix hash refresh remains CI-generated and hash-only", async () => {
  const ciWorkflow = await readFile(ciWorkflowPath, "utf8");
  const autofixWorkflow = await readFile(nixAutofixWorkflowPath, "utf8");
  const nixReadme = await readFile(nixReadmePath, "utf8");

  assert.match(ciWorkflow, /name: nix-hash-refresh/);
  assert.match(ciWorkflow, /node --experimental-strip-types \.\/scripts\/update-nix-pnpm-deps-hash\.ts/);
  assert.match(ciWorkflow, /git diff -- nix\/pnpm-deps\.nix >"\$out_dir\/nix-pnpm-deps\.patch"/);
  assert.match(ciWorkflow, /retention-days: 14/);

  assert.match(autofixWorkflow, /workflow_run:\n\s+workflows: \[ci\]\n\s+types: \[completed\]/);
  assert.match(autofixWorkflow, /marker='<!-- nix-hash-refresh -->'/);
  assert.match(autofixWorkflow, /if \[ "\$changed_files" != "nix\/pnpm-deps\.nix" \]; then/);
  assert.match(autofixWorkflow, /git apply --check "\$patch_path"/);
  assert.match(autofixWorkflow, /artifact_head_sha.*head_sha/);

  assert.match(nixReadme, /\.github\/workflows\/ci\.yml/);
  assert.match(nixReadme, /\.github\/workflows\/nix-hash-autofix\.yml/);
});

test("agent PR exploration remains gated with slim artifacts and mirror transport", async () => {
  const workflow = await readFile(agentExploreWorkflowPath, "utf8");
  const script = await readFile(agentExploreScriptPath, "utf8");

  assert.match(workflow, /vars\.AGENT_PR_EXPLORE_ENABLED == 'true'/);
  assert.match(workflow, /contains\(fromJSON\('\["OWNER","MEMBER","COLLABORATOR"\]'\), github\.event\.comment\.author_association\)/);
  assert.match(workflow, /!\$\{\{ runner\.temp \}\}\/agent-pr-explore-sandbox\/artifacts\/\*\*\/\*\.zip/);
  assert.match(workflow, /!\$\{\{ runner\.temp \}\}\/agent-pr-explore-sandbox\/artifacts\/\*\*\/\*\.webm/);

  assert.match(script, /agent_report_file="\$artifacts\/agent-report\.md"/);
  assert.match(script, /agent-pr-exploration-report\.md/);
  assert.match(script, /registry\.npmmirror\.com/);
  assert.match(script, /PLAYWRIGHT_DOWNLOAD_HOST="https:\/\/npmmirror\.com\/mirrors\/playwright"/);
  assert.match(script, /report_persist_dir="\$\{OD_SANDBOX_REPORT_DIR:-\$HOME\/\.cache\/agent-pr-explore\/reports\}\/pr-\$\{PR_NUMBER\}"/);
});

function quotedPathPattern(filePath: string): RegExp {
  return new RegExp(`"${escapeRegExp(filePath)}"`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
