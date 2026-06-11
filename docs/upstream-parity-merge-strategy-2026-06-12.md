# Upstream Parity Merge Strategy - 2026-06-12

This document records the first Ralph execution step for issue
[#1](https://github.com/sunseol/opendesign-tauri/issues/1): merge upstream
`nexu-io/open-design` safely while preserving Tauri as the default desktop
runtime.

## Baseline

- Current branch: `codex/electron-to-tauri-migration`
- Upstream target: `upstream/main@ca22620b4fa0`
- Merge base: `4cb5778669a09ca0523c46c1b7592017549275ec`
- Dry-run command:

```bash
git merge-tree --write-tree --name-only HEAD upstream/main
```

The dry-run reports `48` conflicted paths.

## Non-Negotiable Resolution Rule

Do not resolve upstream parity conflicts by restoring Electron as the default
desktop runtime.

When upstream modifies old Electron desktop files that this fork deleted, the
default resolution is:

1. Keep the Tauri-first deletion.
2. Inspect the upstream change for portable behavior.
3. Port useful behavior into `apps/desktop/src-tauri`, `apps/packaged`, or
   shared helper packages.
4. Preserve Electron only as an explicit fallback path.

## Conflict Inventory

### Workflows And Release

- `.github/scripts/release/cache/win.ps1`
- `.github/workflows/ci.yml`
- `.github/workflows/release-beta.yml`
- `.github/workflows/release-preview.yml`
- `.github/workflows/release-stable.yml`

Resolution rule:

- Port upstream CI/release hardening.
- Preserve fork reality that workflow approval is a maintainer action.
- Preserve Tauri package validation as the release default.
- Do not reintroduce Electron-only release assumptions.

### Root Metadata And Workspace Manifests

- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

Resolution rule:

- Preserve the Tauri fork README identity.
- Import upstream package/workspace additions only after checking Tauri package
  closure.
- Run `pnpm install` after manifest/lockfile resolution.
- Refresh Nix pnpm deps hash if the lockfile changes.

### Daemon

- `apps/daemon/src/server.ts`
- `apps/daemon/tests/server-paths.test.ts`

Resolution rule:

- Prefer upstream route/server refactors unless they conflict with Tauri sidecar
  discovery.
- Preserve local daemon/web/desktop namespace and IPC assumptions.
- Run daemon tests and contract tests after resolution.

### Desktop Shell

Modify/delete conflicts where upstream modified Electron-era files that this
fork deleted:

- `apps/desktop/src/main/diagnostics.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/pdf-export.ts`
- `apps/desktop/src/main/preload.cts`
- `apps/desktop/src/main/runtime.ts`
- `apps/desktop/tests/main/hide-window-exiting-fullscreen.test.ts`
- `apps/desktop/tests/main/preload-host-boundary.test.ts`
- `apps/desktop/tests/main/save-print-ready-document-as-pdf.test.ts`
- `apps/desktop/tests/main/updater-host-boundary.test.ts`

Resolution rule:

- Keep the files deleted unless a specific upstream behavior is still required.
- Recreate behavior in Tauri or packaged runtime code, not in default Electron
  shell code.
- Add or update Tauri tests when upstream test intent remains relevant.

### Packaged Runtime

- `apps/packaged/package.json`
- `apps/packaged/src/index.ts`
- `apps/packaged/src/launch.ts`
- `apps/packaged/tests/desktop-url-allowlist.test.ts`
- `apps/packaged/tests/launch.test.ts`

Resolution rule:

- Manual merge required.
- Port upstream packaged launcher/updater/resource hardening.
- Keep Tauri sidecar and namespace behavior.
- Validate packaged launch tests after resolution.

### Web And Project UI

- `apps/web/package.json`
- `apps/web/src/components/NewProjectPanel.tsx`

Resolution rule:

- Prefer upstream product behavior.
- Preserve Tauri/local-folder behavior where it differs only because of the
  desktop host.
- Run web typecheck/tests for touched UI.

### E2E

- `e2e/lib/vitest/smoke-suite.ts`
- `e2e/lib/vitest/tools-dev.ts`
- `e2e/specs/mac.spec.ts`
- `e2e/tests/dialog/artifact-consistency.test.ts`
- `e2e/tests/packaged-smoke-workflow.test.ts`

Resolution rule:

- Preserve upstream P0 smoke intent.
- Adapt assertions to Tauri default runtime.
- Do not delete tests to force a green merge.

### Platform And Packaging Tools

- `packages/platform/src/index.ts`
- `tools/pack/package.json`
- `tools/pack/src/config.ts`
- `tools/pack/src/index.ts`
- `tools/pack/src/linux.ts`
- `tools/pack/src/mac/build.ts`
- `tools/pack/src/win/build.ts`
- `tools/pack/src/win/builder.ts`
- `tools/pack/tests/linux.test.ts`
- `tools/pack/tests/mac-identity.test.ts`
- `tools/pack/tests/mac-lifecycle.test.ts`
- `tools/pack/tests/mac-prebundle.test.ts`
- `tools/pack/tests/mac.test.ts`
- `tools/pack/tests/win-app.test.ts`
- `tools/pack/tests/win-prebundle.test.ts`

Resolution rule:

- This is the highest-risk conflict group for the Tauri migration.
- Port upstream packaging hardening into the Tauri-first `tools-pack` model.
- Keep explicit Electron fallback only where the fork still supports it.
- Run package-scoped `tools-pack` tests after each small resolution batch.

## Recommended Merge Batches

Do not resolve the 48 conflicts in one commit. Use small batches:

1. **Batch A - manifests and workspace metadata**
   - `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, app/tool
     package manifests.
2. **Batch B - Tauri packaged runtime**
   - `apps/packaged`, `packages/platform`, runtime helper packages.
3. **Batch C - tools-pack**
   - mac/win/linux builders, Tauri config, packaging tests.
4. **Batch D - desktop shell**
   - port useful upstream Electron-shell behavior to Tauri or leave deleted.
5. **Batch E - daemon/web/e2e**
   - daemon server, NewProjectPanel, smoke/e2e tests.
6. **Batch F - workflows and docs**
   - CI/release workflows, README/fork identity, workflow approval notes.

## Verification Plan

After each batch:

```bash
git diff --check
pnpm guard
pnpm typecheck
```

Then add scoped checks:

- contracts: `pnpm --filter @open-design/contracts build`
- daemon: `pnpm --filter @open-design/daemon test`
- web: `pnpm --filter @open-design/web typecheck`
- tools-pack: relevant `pnpm --filter @open-design/tools-pack ...` tests/builds
- desktop: `pnpm tools-dev inspect desktop status --json`
- packaged: platform-specific `pnpm tools-pack <platform> build ...`

## Current #1 Status

`#1` is not complete. The conflict inventory and resolution policy are complete,
but the actual upstream merge has not been applied yet.

Next step: start Batch A in a dedicated commit and keep the working tree
reviewable after each resolved conflict group.
