import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

const fixedGovernancePaths = [
  "CONTRIBUTING.md",
  "MAINTAINERS.md",
  ".github/pull_request_template.md",
  "docs/deployment/docker.md",
  "docs/skills-contributing.md",
  "docs/v0.8.0-announcement.zh-CN.md",
] as const;

const upstreamActionLinks = [
  "https://github.com/nexu-io/open-design/issues",
  "https://github.com/nexu-io/open-design/discussions",
  "https://github.com/nexu-io/open-design/pulls",
  "git clone https://github.com/nexu-io/open-design.git",
] as const;

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function collectIssueTemplatePaths(): Promise<readonly string[]> {
  const templateDir = path.join(repoRoot, ".github", "ISSUE_TEMPLATE");
  const entries = await readdir(templateDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yml"))
    .map((entry) => path.join(".github", "ISSUE_TEMPLATE", entry.name))
    .sort();
}

test("governance entrypoints identify the Tauri fork", async () => {
  const readme = await readText("README.md");
  const contributing = await readText("CONTRIBUTING.md");
  const pullRequestTemplate = await readText(".github/pull_request_template.md");
  const tutorialTemplate = await readText(".github/ISSUE_TEMPLATE/tutorial-submission.yml");

  assert.match(readme, /not the official `nexu-io\/open-design` repository/);
  assert.match(readme, /This fork: <https:\/\/github\.com\/sunseol\/opendesign-tauri>/);
  assert.match(contributing, /# Contributing to Open Design Tauri/);
  assert.match(contributing, /`sunseol\/opendesign-tauri` Tauri migration fork/);
  assert.match(pullRequestTemplate, /Tauri desktop menu bar/);
  assert.match(tutorialTemplate, /Open Design Tauri/);
});

test("governance entrypoints avoid upstream contributor-action links", async () => {
  const issueTemplatePaths = await collectIssueTemplatePaths();
  const scannedPaths = [...fixedGovernancePaths, ...issueTemplatePaths];
  const offenders: string[] = [];

  for (const filePath of scannedPaths) {
    const text = await readText(filePath);
    for (const link of upstreamActionLinks) {
      if (text.includes(link)) offenders.push(`${filePath}: ${link}`);
    }
  }

  assert.deepEqual(offenders, []);
});
