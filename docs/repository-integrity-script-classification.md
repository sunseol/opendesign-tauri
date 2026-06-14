# Repository Integrity Script Classification

This file records the non-upstream script and Nix decisions that remain in
the Tauri fork while upstream parity work continues. The goal is to keep
repository-integrity tooling intentional: upstream checks are ported when they
apply, fork-only migration guards stay only while they protect active Tauri
work, and Nix work that needs a local Nix evaluator is deferred explicitly.

## Retained Until M6 Cleanup

These scripts are fork-specific migration safety rails. They are retained until
the Electron-to-Tauri migration reaches the final M6 cleanup state and the
repository no longer needs handoff, platform-gate, or default-flip protection.

| Script | Classification | Why it stays | Retirement condition |
| --- | --- | --- | --- |
| `scripts/advance-tauri-migration-m4-m5.ts` | Retained until M6 cleanup | Sequences verified native platform evidence into the M5 default flip. | Remove after M6 proves no default-flip gate remains. |
| `scripts/apply-tauri-migration-m5.ts` | Retained until M6 cleanup | Applies the guarded M5 default change only after remote/platform evidence. | Remove after Tauri is the only supported desktop runtime path. |
| `scripts/continue-tauri-migration.ts` | Retained until M6 cleanup | Provides the resumable handoff command used by long-running migration work. | Remove after the migration status command reports final cleanup complete. |
| `scripts/create-tauri-migration-bundle.ts` | Retained until M6 cleanup | Creates portable migration handoff bundles for receiver checkouts. | Remove when no external native smoke handoff is needed. |
| `scripts/download-tauri-m4-reports.ts` | Retained until M6 cleanup | Fetches and verifies native M4 platform report artifacts. | Remove after M4/M5 evidence no longer gates any workflow. |
| `scripts/import-tauri-migration-bundle.ts` | Retained until M6 cleanup | Imports handoff bundles without losing branch-head validation. | Remove with the handoff bundle workflow. |
| `scripts/package-tauri-migration-handoff.ts` | Retained until M6 cleanup | Packages verified handoff directories with checksums and command sidecars. | Remove when source archives replace migration handoffs. |
| `scripts/push-tauri-migration-handoff.ts` | Retained until M6 cleanup | Pushes handoff branches while preserving remote-head checks. | Remove when no migration receiver branch is required. |
| `scripts/tauri-ci-scope.test.ts` | Retained until M6 cleanup | Locks CI path filters so migration evidence changes run packaged smoke gates. | Remove after migration evidence scripts are gone. |
| `scripts/tauri-migration-command-sidecar.ts` | Retained until M6 cleanup | Generates executable handoff commands that validate bundle integrity. | Remove with handoff packaging. |
| `scripts/tauri-migration-inventory.ts` | Retained until M6 cleanup | Reports Electron residue and M6 cleanup inventory. | Remove after inventory reports zero actionable Electron residue. |
| `scripts/tauri-migration-policy.ts` | Retained until M6 cleanup | Encodes phase-order policy for M4, M5, and M6. | Remove after phase order is no longer meaningful. |
| `scripts/tauri-migration-pr-body.ts` | Retained until M6 cleanup | Keeps generated migration PR bodies aligned across handoff tools. | Remove with migration handoff tooling. |
| `scripts/tauri-migration-status.ts` | Retained until M6 cleanup | Summarizes the current migration phase and next required evidence. | Remove after final M6 completion is recorded. |
| `scripts/verify-tauri-migration-handoff.ts` | Retained until M6 cleanup | Verifies a handoff bundle round-trip before pushing or importing. | Remove when handoff bundles retire. |
| `scripts/verify-tauri-migration-remote.ts` | Retained until M6 cleanup | Confirms remote branch identity before evidence-based advancement. | Remove after migration advancement stops depending on branch handoff. |
| `scripts/verify-tauri-platform-gates.ts` | Retained until M6 cleanup | Validates native Windows/Linux report evidence before phase advancement. | Remove after native report gates are no longer migration-specific. |

## Ported Upstream Integrity Checks

The following upstream-aligned checks are active in `pnpm guard`: cross-app
import isolation, product-neutrality, postinstall/bin-link checks, UI P0 path
parity, shared UI component package wiring, design-system manifest integrity,
fork workflow approval policy, and Nix hash updater coverage. These are not
temporary migration tools; keep them unless a later upstream contract replaces
them.

## Release/Governance Workflow Classification

The release/governance parity lane for
[#36](https://github.com/sunseol/opendesign-tauri/issues/36) is intentionally
split between active fork workflows and upstream workflows that should not be
copied verbatim while this repository is still Tauri-first.

Active fork governance:

- `.github/workflows/fork-pr-workflow-approval.yml` runs the low-risk fork
  workflow approval policy from trusted base code.
- `.github/workflows/actionlint.yml` keeps workflow syntax and runner-label
  drift visible.
- `.github/workflows/agent-pr-explore-sandbox.yml` is present but disabled by
  default behind `AGENT_PR_EXPLORE_ENABLED`; maintainers must intentionally
  provision the self-hosted runner before `/explore` or manual dispatch can run.
- `.github/workflows/contributor-card-bot.yml` and
  `.github/workflows/notify-main-ci-feishu.yml` are fork-gated and disabled by
  default behind repository variables.
- `.github/actions/setup-workspace` and `.github/actions/setup-playwright`
  provide the cached pnpm and Playwright setup path. Main Ubuntu CI validation
  jobs use them; Windows/Linux packaged smoke jobs keep their platform-specific
  setup order because Rust, NSIS, GTK/WebKit, and Tauri smoke evidence are part
  of the migration gate.
- `.github/workflows/ci.yml` remains this fork's factual required check. It
  owns `merge_group`, scoped validation, Tauri packaged smoke gates, Nix hash
  refresh artifacts, and runtime summaries.

Classified but not copied verbatim:

- Upstream `.github/workflows/ci-gate.yml`,
  `.github/workflows/ci-hosted.yml`, `.github/workflows/ci-runner.yml`, and
  `.github/workflows/scripts/ci/**` describe a split hosted/self-hosted
  aggregation stack. This fork keeps the direct `ci.yml` gate until repository
  rulesets and Tauri packaged-smoke requirements are redesigned around that
  split stack.
- Upstream `.github/workflows/notify-daily-feishu.yml`,
  `.github/workflows/notify-release-feishu.yml`, and
  `.github/scripts/release/feishu/notify.ts` target the official upstream
  release streams. They should not run here until Tauri release ownership,
  Feishu destinations, and release-branch policy are explicitly configured.
- Upstream release PowerShell and macOS build script deltas remain release
  engineering work under #12/#14 rather than generic governance work under #36.

The agent PR exploration path carries the upstream operational safeguards that
do apply to this fork: it writes a clean Markdown report, keeps large trace zip
and webm artifacts out of the GitHub artifact upload, can publish trace media
to R2 when configured, persists small report pointers on the runner, and uses
the `registry.npmmirror.com` / `npmmirror.com` transport mirrors inside the
isolated sandbox while retaining lockfile integrity checks.

## Deferred Nix Split-Hash Work

Upstream now shapes Nix packaging around source-filtered pnpm stores:
`nix/package-daemon.nix` consumes `daemonHash`, `nix/package-web.nix` consumes
`webHash`, and both derivations pass filtered workspace paths into
`fetchPnpmDeps`.

This fork still uses the single shared `hash` in `nix/pnpm-deps.nix` because
the current local environment has no `nix` binary and cannot calculate fresh
fixed-output hashes for the filtered daemon and web stores. The updater script
already understands both the single-hash and split-hash file shapes, and
`nix/README.md` documents the split migration path. Porting the derivation
structure should happen in a Nix-capable environment that can run the relevant
`nix build` or `nix flake check` commands and commit the resulting
`daemonHash` / `webHash` values together with the derivation change.
