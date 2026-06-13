import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { TOOLS_PR_REPO_SLUG, TOOLS_PR_REPORT_TITLE } from "../src/identity.js";

describe("tools-pr fork identity", () => {
  it("documents the Tauri fork as the maintainer control-plane target", async () => {
    const agents = await readFile("AGENTS.md", "utf8");
    const entrypoint = await readFile("src/index.ts", "utf8");

    assert.equal(TOOLS_PR_REPO_SLUG, "sunseol/opendesign-tauri");
    assert.match(agents, new RegExp(TOOLS_PR_REPO_SLUG));
    assert.match(entrypoint, new RegExp(TOOLS_PR_REPO_SLUG));
    assert.doesNotMatch(agents, /nexu-io\/open-design/);
    assert.doesNotMatch(entrypoint, /nexu-io\/open-design/);
  });

  it("keeps the human triage report title on the fork-local label", async () => {
    const listSource = await readFile("src/list.ts", "utf8");

    assert.equal(TOOLS_PR_REPORT_TITLE, "opendesign-tauri PR triage");
    assert.match(listSource, /TOOLS_PR_REPORT_TITLE/);
    assert.doesNotMatch(listSource, /open-design PR triage/);
  });
});
