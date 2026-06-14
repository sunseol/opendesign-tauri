import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");

type SourceCheckRun = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function asRecord(value: unknown): Record<string, unknown> {
  assert(typeof value === "object" && value !== null);
  return value as Record<string, unknown>;
}

function arrayField(record: Record<string, unknown>, field: string): readonly unknown[] {
  const value = record[field];
  assert(Array.isArray(value));
  return value;
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number") {
    assert.fail(`${field} must be a number`);
  }
  return value;
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    assert.fail(`${field} must be a string`);
  }
  return value;
}

function runSourceCheck(args: readonly string[]): SourceCheckRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/source-check.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (typeof result.stdout !== "string" || typeof result.stderr !== "string") {
    assert.fail("source-check test expected string stdio");
  }
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

test("source-check json mode reports tracked source inventory", () => {
  const result = runSourceCheck(["--format", "json", "--top", "2", "--large-threshold", "1"]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");

  const payload = asRecord(JSON.parse(result.stdout));
  const options = asRecord(payload.options);
  const summary = asRecord(payload.summary);
  const recommendations = arrayField(payload, "recommendations");
  const top = arrayField(payload, "top");

  assert.equal(stringField(options, "format"), "json");
  assert.equal(numberField(options, "top"), 2);
  assert.ok(numberField(summary, "files") > 0);
  assert.ok(numberField(summary, "lines") > 0);
  assert.ok(recommendations.length > 0);
  assert.equal(top.length, 2);

  const firstRecommendation = asRecord(recommendations[0]);
  const firstRecord = asRecord(firstRecommendation.record);
  assert.match(stringField(firstRecord, "repositoryPath"), /^(apps|e2e|packages|scripts|tools)\//);
});

test("source-check rejects invalid numeric options", () => {
  const result = runSourceCheck(["--large-threshold", "0"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--large-threshold must be a positive integer/);
});

test("guard runs source-check smoke tests", () => {
  const manifest = asRecord(readJson("package.json"));
  const scripts = asRecord(manifest.scripts);

  assert.match(stringField(scripts, "guard"), /scripts\/source-check\.test\.ts/);
});
