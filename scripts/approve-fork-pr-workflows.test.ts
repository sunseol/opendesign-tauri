import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPullApprovalStateDrift,
  isAllowedChangedPath,
  isAllowedVisualCaptureChangedPath,
  isDeniedChangedPath,
  isPendingApprovalRun,
  listPendingApprovalRuns,
  normalizeWorkflowPath,
  runTargetsPullRequest,
  waitForPendingApprovalRuns,
} from "./approve-fork-pr-workflows.ts";

function pull(overrides = {}) {
  return {
    number: 2683,
    state: "open",
    changed_files: 1,
    head: {
      ref: "fix/workflow-linkage",
      sha: "734076155c44e569304856590019cea54506fdab",
      repo: { full_name: "someone/opendesign-tauri" },
    },
    base: {
      ref: "main",
      sha: "4cd93a5c7a7b0db1961c854e55f8e0e6b1b45542",
      repo: { full_name: "sunseol/opendesign-tauri" },
    },
    ...overrides,
  };
}

function run(overrides = {}) {
  return {
    id: 26273463769,
    name: "CI",
    event: "pull_request",
    head_branch: "fix/workflow-linkage",
    head_repository: { full_name: "someone/opendesign-tauri" },
    status: "completed",
    conclusion: "action_required",
    head_sha: "734076155c44e569304856590019cea54506fdab",
    path: ".github/workflows/ci.yml@main",
    pull_requests: [],
    ...overrides,
  };
}

test("normalizes workflow paths that include a ref suffix", () => {
  assert.equal(normalizeWorkflowPath(".github/workflows/ci.yml@main"), ".github/workflows/ci.yml");
  assert.equal(normalizeWorkflowPath(".github/workflows/ci.yml"), ".github/workflows/ci.yml");
});

test("changed-path policy allows ordinary docs and app/package source while blocking privileged surfaces", () => {
  assert.equal(isAllowedChangedPath("README.md"), true);
  assert.equal(isAllowedChangedPath("docs/roadmap.md"), true);
  assert.equal(isAllowedChangedPath("apps/web/src/app/page.tsx"), true);
  assert.equal(isAllowedChangedPath("apps/web/tests/page.test.tsx"), true);
  assert.equal(isAllowedChangedPath("apps/daemon/src/server.ts"), true);
  assert.equal(isAllowedChangedPath("packages/contracts/tests/api.test.ts"), true);

  assert.equal(isAllowedChangedPath(".github/workflows/ci.yml"), false);
  assert.equal(isAllowedChangedPath("scripts/build.ts"), false);
  assert.equal(isAllowedChangedPath("e2e/scripts/visual.ts"), false);
  assert.equal(isAllowedChangedPath("nix/pnpm-deps.nix"), false);
  assert.equal(isAllowedChangedPath("tools/pack/src/index.ts"), false);
  assert.equal(isAllowedChangedPath("package.json"), false);
  assert.equal(isAllowedChangedPath("apps/web/package.json"), false);
  assert.equal(isAllowedChangedPath("pnpm-lock.yaml"), false);
  assert.equal(isAllowedChangedPath("flake.nix"), false);
  assert.equal(isAllowedChangedPath("apps/desktop/src-tauri/src/main.rs"), false);
});

test("denied-path policy blocks common tool config files under otherwise allowed trees", () => {
  assert.equal(isDeniedChangedPath("apps/web/vite.config.ts"), true);
  assert.equal(isDeniedChangedPath("apps/web/vitest.config.ts"), true);
  assert.equal(isDeniedChangedPath("apps/web/playwright.config.ts"), true);
  assert.equal(isDeniedChangedPath("apps/web/tsconfig.sidecar.json"), true);
  assert.equal(isDeniedChangedPath("packages/contracts/esbuild.config.mjs"), true);
  assert.equal(isDeniedChangedPath("apps/web/src/app/page.tsx"), false);
});

test("visual capture auto-approval is limited to web TypeScript and CSS source", () => {
  assert.equal(isAllowedVisualCaptureChangedPath("apps/web/src/app/page.tsx"), true);
  assert.equal(isAllowedVisualCaptureChangedPath("apps/web/src/lib/theme.ts"), true);
  assert.equal(isAllowedVisualCaptureChangedPath("apps/web/src/components/Button.css"), true);
  assert.equal(isAllowedVisualCaptureChangedPath("apps/web/public/logo.png"), false);
  assert.equal(isAllowedVisualCaptureChangedPath("apps/web/tests/Button.test.tsx"), false);
  assert.equal(isAllowedVisualCaptureChangedPath("packages/contracts/src/api.ts"), false);
});

test("isPendingApprovalRun matches only action_required pull_request runs from allowlisted workflows", () => {
  const pr = pull();

  assert.equal(isPendingApprovalRun(run(), pr), true);
  assert.equal(isPendingApprovalRun(run({ status: "action_required", conclusion: null }), pr), true);
  assert.equal(isPendingApprovalRun(run({ conclusion: "success" }), pr), false);
  assert.equal(isPendingApprovalRun(run({ event: "workflow_run" }), pr), false);
  assert.equal(isPendingApprovalRun(run({ head_sha: "08a88a65482123629ebda5a090c71533bd6b8a88" }), pr), false);
  assert.equal(isPendingApprovalRun(run({ path: ".github/workflows/release-stable.yml@main" }), pr), false);
});

test("isPendingApprovalRun applies strict changed-file filtering only to visual capture", () => {
  const pr = pull();
  const visualRun = run({
    name: "Visual PR Capture",
    path: ".github/workflows/visual-pr-capture.yml@main",
  });

  assert.equal(
    isPendingApprovalRun(visualRun, pr, [
      { filename: "apps/web/src/components/Button.tsx", status: "modified" },
      { filename: "apps/web/src/styles/button.css", status: "modified" },
    ]),
    true,
  );
  assert.equal(
    isPendingApprovalRun(visualRun, pr, [{ filename: "apps/web/public/logo.png", status: "modified" }]),
    false,
  );
  assert.equal(
    isPendingApprovalRun(visualRun, pr, [
      {
        filename: "apps/web/src/components/Button.tsx",
        previous_filename: "scripts/build.ts",
        status: "renamed",
      },
    ]),
    false,
  );
  assert.equal(isPendingApprovalRun(run(), pr, [{ filename: "README.md", status: "modified" }]), true);
});

test("runTargetsPullRequest disambiguates workflow runs using GitHub PR associations", () => {
  const pr = pull();
  const otherPr = pull({
    number: 3001,
    base: {
      ref: "release",
      sha: "8db117d728f967d108f6fdd64cb8d921d057f7f6",
      repo: { full_name: "sunseol/opendesign-tauri" },
    },
  });

  assert.equal(runTargetsPullRequest(run(), pr, [pr], []), true);
  assert.equal(runTargetsPullRequest(run(), pr, [pr, otherPr], []), false);
  assert.equal(runTargetsPullRequest(run({ pull_requests: [pr] }), pr, [pr, otherPr], []), true);
  assert.equal(runTargetsPullRequest(run({ pull_requests: [otherPr] }), pr, [pr, otherPr], []), false);
  assert.equal(runTargetsPullRequest(run({ pull_requests: [pr, otherPr] }), pr, [pr], []), false);
});

test("runTargetsPullRequest allows empty associations only when the fork head identity maps to one open PR", () => {
  const pr = pull();
  const otherPr = pull({
    number: 3001,
    base: {
      ref: "release",
      sha: "8db117d728f967d108f6fdd64cb8d921d057f7f6",
      repo: { full_name: "sunseol/opendesign-tauri" },
    },
  });

  assert.equal(runTargetsPullRequest(run(), pr, [], [pr]), true);
  assert.equal(runTargetsPullRequest(run(), pr, [], [pr, otherPr]), false);
  assert.equal(
    runTargetsPullRequest(
      run({
        head_branch: "different-branch",
        head_repository: { full_name: "someone/opendesign-tauri" },
      }),
      pr,
      [],
      [pr],
    ),
    false,
  );
});

test("listPendingApprovalRuns paginates all pull_request runs and filters action_required client-side", async () => {
  const pr = pull();
  const requestedPaths: string[] = [];
  const pendingRuns = await listPendingApprovalRuns("sunseol/opendesign-tauri", pr, {
    loadWorkflowRunsResponsePage: async (path) => {
      requestedPaths.push(path);
      if (path.endsWith("page=1")) {
        return {
          workflow_runs: Array.from({ length: 100 }, (_, index) =>
            run({
              id: 26273463600 + index,
              conclusion: "success",
            }),
          ),
        };
      }

      return {
        workflow_runs: [run(), run({ id: 26273463770, conclusion: "success" })],
      };
    },
    loadPullRequestsForHeadSha: async () => [],
    loadPullRequestsForHeadRef: async () => [pr],
  });

  assert.deepEqual(requestedPaths, [
    "/repos/sunseol/opendesign-tauri/actions/runs?event=pull_request&head_sha=734076155c44e569304856590019cea54506fdab&per_page=100&page=1",
    "/repos/sunseol/opendesign-tauri/actions/runs?event=pull_request&head_sha=734076155c44e569304856590019cea54506fdab&per_page=100&page=2",
  ]);
  assert.equal(requestedPaths.some((path) => path.includes("status=action_required")), false);
  assert.deepEqual(
    pendingRuns.map((pendingRun) => pendingRun.id),
    [26273463769],
  );
});

test("listPendingApprovalRuns uses visual capture changed-file filtering", async () => {
  const pr = pull({ head: { ...pull().head, ref: "fix/readme-copy" } });
  const workflowRuns = [
    run({ head_branch: pr.head.ref }),
    run({
      id: 26273463770,
      name: "Visual PR Capture",
      path: ".github/workflows/visual-pr-capture.yml@main",
      head_branch: pr.head.ref,
    }),
  ];
  const deps = {
    loadWorkflowRunsResponsePage: async () => ({ workflow_runs: workflowRuns }),
    loadPullRequestsForHeadSha: async () => [pr],
  };

  assert.deepEqual(
    (await listPendingApprovalRuns(
      "sunseol/opendesign-tauri",
      pr,
      [{ filename: "README.md", status: "modified" }],
      deps,
    )).map((pendingRun) => pendingRun.id),
    [26273463769],
  );
  assert.deepEqual(
    (await listPendingApprovalRuns(
      "sunseol/opendesign-tauri",
      pr,
      [{ filename: "apps/web/src/components/Button.tsx", status: "modified" }],
      deps,
    )).map((pendingRun) => pendingRun.id),
    [26273463769, 26273463770],
  );
});

test("hasPullApprovalStateDrift ignores base tip churn but rejects retargeting and head drift", () => {
  const pr = pull();

  assert.equal(hasPullApprovalStateDrift(pr, pr), false);
  assert.equal(hasPullApprovalStateDrift(pr, { ...pr, base: { ...pr.base, sha: "08a88a65482123629ebda5a090c71533bd6b8a88" } }), false);
  assert.equal(hasPullApprovalStateDrift(pr, { ...pr, draft: true }), true);
  assert.equal(hasPullApprovalStateDrift(pr, { ...pr, state: "closed" }), true);
  assert.equal(hasPullApprovalStateDrift(pr, { ...pr, head: { ...pr.head, sha: "08a88a65482123629ebda5a090c71533bd6b8a88" } }), true);
  assert.equal(hasPullApprovalStateDrift(pr, { ...pr, base: { ...pr.base, ref: "release" } }), true);
});

test("waitForPendingApprovalRuns waits for first appearance and then returns the latest stable run set", async () => {
  const ciRun = run();
  const visualRun = run({
    id: 26273463770,
    name: "Visual PR Verify",
    path: ".github/workflows/visual-pr-verify.yml@main",
  });
  const batches = [[], [], [ciRun], [ciRun], [ciRun, visualRun], [ciRun, visualRun]];
  const sleeps: number[] = [];
  let now = 0;

  const pendingRuns = await waitForPendingApprovalRuns(
    async () => batches.shift() ?? [ciRun, visualRun],
    async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    () => now,
    { firstAppearanceTimeoutMs: 12_000, settlingWindowMs: 9_000 },
  );

  assert.deepEqual(pendingRuns, [ciRun, visualRun]);
  assert.deepEqual(sleeps, [3000, 3000, 3000, 3000, 3000, 3000, 3000]);
});

test("waitForPendingApprovalRuns stops after the first-appearance timeout when no runs arrive", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  let now = 0;

  const pendingRuns = await waitForPendingApprovalRuns(
    async () => {
      calls += 1;
      return [];
    },
    async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    () => now,
    { firstAppearanceTimeoutMs: 9_000 },
  );

  assert.deepEqual(pendingRuns, []);
  assert.equal(calls, 4);
  assert.equal(sleeps.length, 3);
  assert.equal(now, 9_000);
});
