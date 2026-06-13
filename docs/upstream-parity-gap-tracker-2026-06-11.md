# Upstream Parity Gap Tracker - 2026-06-11

이 문서는 "무엇이 빠졌는지"를 계속 추적하기 위한 작업판입니다. GitHub issue가
등록되어 있어도 실제 port는 아직 시작 전이므로, 모든 항목의 현재 상태는
`Not started`입니다.

## Current Snapshot

- Upstream: `nexu-io/open-design@ca22620b4fa0`
- Tauri fork: `sunseol/opendesign-tauri@2265d8d43`
- Divergence: fork-only `231` commits, upstream-only `956` commits
- Diff size: `4,326` files changed
- Open parity issues: `54`

## What Was Newly Found After The 48-Issue Audit

The second pass found six weakly tracked areas that were too easy to miss:

| Gap | Why it matters | Tracking issue |
| --- | --- | --- |
| Skills, design templates, prompt templates | User-visible creation capability lives here, not only in plugin marketplace UI. | [#49](https://github.com/sunseol/opendesign-tauri/issues/49) |
| Runtime helper packages | Packaged Tauri depends on download/host/launcher/sidecar helpers behaving correctly. | [#50](https://github.com/sunseol/opendesign-tauri/issues/50) |
| Telemetry worker | App analytics and object relay can drift even if web-side events are ported. | [#51](https://github.com/sunseol/opendesign-tauri/issues/51) |
| `tools-serve` fixtures | Updater/release smoke tests need deterministic local metadata. | [#52](https://github.com/sunseol/opendesign-tauri/issues/52) |
| Guard/Nix/integrity scripts | Parity work can regress boundaries unless guard scripts match upstream. | [#53](https://github.com/sunseol/opendesign-tauri/issues/53) |
| Curated data assets | Community, preview, plugin, and analytics surfaces depend on seed data. | [#54](https://github.com/sunseol/opendesign-tauri/issues/54) |

## Coverage Matrix

| Area | Diff signal | Primary issues | Status |
| --- | ---: | --- | --- |
| Upstream integration strategy | 956 upstream-only commits | [#1](https://github.com/sunseol/opendesign-tauri/issues/1) | Not started |
| Web app and Studio | `apps/web` 576 files | [#2](https://github.com/sunseol/opendesign-tauri/issues/2), [#3](https://github.com/sunseol/opendesign-tauri/issues/3), [#9](https://github.com/sunseol/opendesign-tauri/issues/9), [#15](https://github.com/sunseol/opendesign-tauri/issues/15), [#17](https://github.com/sunseol/opendesign-tauri/issues/17), [#18](https://github.com/sunseol/opendesign-tauri/issues/18), [#19](https://github.com/sunseol/opendesign-tauri/issues/19), [#26](https://github.com/sunseol/opendesign-tauri/issues/26), [#41](https://github.com/sunseol/opendesign-tauri/issues/41), [#42](https://github.com/sunseol/opendesign-tauri/issues/42), [#44](https://github.com/sunseol/opendesign-tauri/issues/44) | Not started |
| Daemon/runtime/API | `apps/daemon` 353 files | [#7](https://github.com/sunseol/opendesign-tauri/issues/7), [#20](https://github.com/sunseol/opendesign-tauri/issues/20), [#29](https://github.com/sunseol/opendesign-tauri/issues/29), [#30](https://github.com/sunseol/opendesign-tauri/issues/30), [#33](https://github.com/sunseol/opendesign-tauri/issues/33), [#43](https://github.com/sunseol/opendesign-tauri/issues/43), [#48](https://github.com/sunseol/opendesign-tauri/issues/48) | In progress - Grok Build prompt-file transport, duplicate route guard, and sandbox runtime isolation wired |
| Contracts/shared DTOs | `packages/contracts` 48 files | [#43](https://github.com/sunseol/opendesign-tauri/issues/43) | In progress - chat run lifecycle and integrations analytics contract drift covered |
| Shared UI package | `packages/components` 13 files | [#44](https://github.com/sunseol/opendesign-tauri/issues/44) | Not started |
| Design systems | `design-systems` 1,666 files | [#8](https://github.com/sunseol/opendesign-tauri/issues/8), [#34](https://github.com/sunseol/opendesign-tauri/issues/34), [#35](https://github.com/sunseol/opendesign-tauri/issues/35) | Not started |
| Plugins and marketplace | `plugins` 596 files | [#5](https://github.com/sunseol/opendesign-tauri/issues/5), [#21](https://github.com/sunseol/opendesign-tauri/issues/21), [#22](https://github.com/sunseol/opendesign-tauri/issues/22), [#47](https://github.com/sunseol/opendesign-tauri/issues/47) | Not started |
| Skills/templates/prompts | `skills` 94 files, `design-templates` 23 files, `prompt-templates` 5 files | [#49](https://github.com/sunseol/opendesign-tauri/issues/49), [#38](https://github.com/sunseol/opendesign-tauri/issues/38), [#21](https://github.com/sunseol/opendesign-tauri/issues/21) | Not started |
| Landing/community/docs | `apps/landing-page` 270 files, `plugins/community` 100 files, `docs` 78 files | [#10](https://github.com/sunseol/opendesign-tauri/issues/10), [#13](https://github.com/sunseol/opendesign-tauri/issues/13), [#23](https://github.com/sunseol/opendesign-tauri/issues/23), [#24](https://github.com/sunseol/opendesign-tauri/issues/24), [#25](https://github.com/sunseol/opendesign-tauri/issues/25), [#39](https://github.com/sunseol/opendesign-tauri/issues/39), [#40](https://github.com/sunseol/opendesign-tauri/issues/40), [#54](https://github.com/sunseol/opendesign-tauri/issues/54) | In progress - fork governance links and template guard covered |
| Desktop and packaged runtime | `apps/desktop` 34 files, `apps/packaged` 28 files | [#14](https://github.com/sunseol/opendesign-tauri/issues/14), [#27](https://github.com/sunseol/opendesign-tauri/issues/27), [#37](https://github.com/sunseol/opendesign-tauri/issues/37), [#50](https://github.com/sunseol/opendesign-tauri/issues/50) | In progress - runtime helper package closure guarded for Tauri packaging |
| Release, CI, tools, fixtures | `.github` 88 files, `tools/pack` 87 files, `tools/pr` 20 files, `tools/serve` 10 files | [#12](https://github.com/sunseol/opendesign-tauri/issues/12), [#28](https://github.com/sunseol/opendesign-tauri/issues/28), [#36](https://github.com/sunseol/opendesign-tauri/issues/36), [#45](https://github.com/sunseol/opendesign-tauri/issues/45), [#52](https://github.com/sunseol/opendesign-tauri/issues/52), [#53](https://github.com/sunseol/opendesign-tauri/issues/53) | In progress - tools-dev local env/shared-port parity, tools-dev/tools-pack metatool metadata, tools-pr fork-retention guard, tools-serve updater/release fixture, and Nix hash helper parity verified |
| Analytics and observability | contracts + web + daemon + telemetry worker | [#11](https://github.com/sunseol/opendesign-tauri/issues/11), [#31](https://github.com/sunseol/opendesign-tauri/issues/31), [#32](https://github.com/sunseol/opendesign-tauri/issues/32), [#51](https://github.com/sunseol/opendesign-tauri/issues/51) | In progress - telemetry worker object authorization, trace-scope registration, signed-token R2 writes, prompt-stack diagnostics, and deploy docs covered |
| Deployment assets | `charts`, `deploy`, deployment docs | [#46](https://github.com/sunseol/opendesign-tauri/issues/46) | Not started |
| Curated data | `data` 4 files | [#54](https://github.com/sunseol/opendesign-tauri/issues/54), [#47](https://github.com/sunseol/opendesign-tauri/issues/47), [#23](https://github.com/sunseol/opendesign-tauri/issues/23) | In progress - data seed imported; packaged plugin-preview manifest path and integrity guard covered |

## Priority Queue

## Active Ralph Progress

- [#1](https://github.com/sunseol/opendesign-tauri/issues/1) is now
  `In progress`.
- Merge dry-run command:
  `git merge-tree --write-tree --name-only HEAD upstream/main`
- Dry-run result: `48` conflicted paths.
- Strategy document:
  [upstream-parity-merge-strategy-2026-06-12.md](upstream-parity-merge-strategy-2026-06-12.md)
- Important constraint: upstream Electron-era desktop file changes must be
  ported to Tauri or packaged helpers where relevant; they must not restore
  Electron as the default runtime.

### P0 - Integration And Safety Gates

These should move first because later feature ports depend on them or they
protect against unsafe parity claims.

- [#1](https://github.com/sunseol/opendesign-tauri/issues/1) upstream merge/rebase strategy
- [#43](https://github.com/sunseol/opendesign-tauri/issues/43) shared API contracts
- [#50](https://github.com/sunseol/opendesign-tauri/issues/50) runtime helper packages
- [#45](https://github.com/sunseol/opendesign-tauri/issues/45) tools-dev/tools-pack/tools-pr
- [#53](https://github.com/sunseol/opendesign-tauri/issues/53) guard/Nix/integrity scripts
- [#28](https://github.com/sunseol/opendesign-tauri/issues/28) P0 e2e/release smoke
- [#33](https://github.com/sunseol/opendesign-tauri/issues/33) sandbox hardening
- [#48](https://github.com/sunseol/opendesign-tauri/issues/48) privacy/local-boundary fixes

### P1 - Tauri Runtime And Core Product

- [#14](https://github.com/sunseol/opendesign-tauri/issues/14), [#27](https://github.com/sunseol/opendesign-tauri/issues/27), [#37](https://github.com/sunseol/opendesign-tauri/issues/37) desktop/packaged runtime
- [#7](https://github.com/sunseol/opendesign-tauri/issues/7), [#42](https://github.com/sunseol/opendesign-tauri/issues/42) daemon runtime and conversation continuity
- [#2](https://github.com/sunseol/opendesign-tauri/issues/2), [#15](https://github.com/sunseol/opendesign-tauri/issues/15), [#16](https://github.com/sunseol/opendesign-tauri/issues/16), [#18](https://github.com/sunseol/opendesign-tauri/issues/18), [#26](https://github.com/sunseol/opendesign-tauri/issues/26) Studio/reference/artifact/workspace
- [#4](https://github.com/sunseol/opendesign-tauri/issues/4), [#29](https://github.com/sunseol/opendesign-tauri/issues/29), [#30](https://github.com/sunseol/opendesign-tauri/issues/30) AMR/BYOK/model providers

### P2 - Catalog, Public Surface, And Growth Loops

- [#5](https://github.com/sunseol/opendesign-tauri/issues/5), [#21](https://github.com/sunseol/opendesign-tauri/issues/21), [#22](https://github.com/sunseol/opendesign-tauri/issues/22), [#47](https://github.com/sunseol/opendesign-tauri/issues/47) plugins
- [#8](https://github.com/sunseol/opendesign-tauri/issues/8), [#34](https://github.com/sunseol/opendesign-tauri/issues/34), [#35](https://github.com/sunseol/opendesign-tauri/issues/35) design systems
- [#49](https://github.com/sunseol/opendesign-tauri/issues/49), [#38](https://github.com/sunseol/opendesign-tauri/issues/38) skills/templates/media
- [#10](https://github.com/sunseol/opendesign-tauri/issues/10), [#23](https://github.com/sunseol/opendesign-tauri/issues/23), [#24](https://github.com/sunseol/opendesign-tauri/issues/24), [#25](https://github.com/sunseol/opendesign-tauri/issues/25), [#39](https://github.com/sunseol/opendesign-tauri/issues/39), [#40](https://github.com/sunseol/opendesign-tauri/issues/40), [#54](https://github.com/sunseol/opendesign-tauri/issues/54) landing/community/i18n/newsletter/share/data

## Known Tracking Gaps

- This tracker maps feature surfaces, not every individual upstream commit.
- Design-system content is very large. #34 must still produce an inventory
  count before it can be closed.
- Plugin content and baked previews must be reconciled together; closing #21
  without #47 would leave visible preview drift.
- Curated data #54 has the upstream `data/` seed files and the packaged
  `data/plugin-previews` resource path covered. Runtime/web consumers, live R2
  publish validation, and broader community/landing integrations remain open
  under #23, #47, and #54.
- Telemetry worker #51 now reports object-relay readiness in health, fails
  `/api/objects/batch` closed before reading bodies when upload authority is
  absent, IP-throttles configured object uploads before reading bodies, rejects
  marker-only uploads without a server-issued upload token, verifies signed
  upload tokens, writes authorized objects through the R2 binding, issues
  `/api/objects/authorize` upload tokens from KV-registered trace scopes, and
  registers object scopes only for accepted `trace-create` events. Cloudflare
  KV namespace provisioning remains a deployment action under #51/#52.
- Observability #32 now has the daemon-side trace object manifest builder for
  relay URL derivation, authorize-before-batch uploads, registration-only
  manifests, oversized-object handling, and Langfuse bridge sequencing that
  registers trace-safe manifests before daemon artifact uploads. Langfuse trace
  payloads now also accept redacted prompt-stack telemetry, `startChatRun`
  captures the composed prompt parts on the run record, and the daemon bridge
  forwards upstream `promptStack_*` query metadata plus structured generation
  input.
- Contracts #43 now accepts the upstream chat run lifecycle status extensions
  (`cancelRequested`, child process ids, exit observation metadata, and cancel
  response run snapshots) plus the integrations connectors `gate_card`
  analytics click element. Type-level package tests guard those DTO additions.
- Privacy boundary #48 now rejects oversized prompt image attachments before
  agent spawn and fails loudly when accepted upload paths cannot be statted,
  instead of silently dropping required image context from a run.
- Analytics #31 now has the shared upload cohort derivation used by file upload
  result events, with the existing FileWorkspace upload surface moved off its
  local duplicate calculation. Browser exception/safety telemetry now installs
  explicit error handlers, scrubs stack file paths, buffers early events until
  `/api/analytics/config` returns, and keeps product analytics consent separate
  from PostHog key/host availability for stability reporting.
- Tools-serve #52 matches the upstream fixture package except for the fork's
  Tauri metadata assertion. Its Vitest suite, typecheck, and a live
  `pnpm tools-serve start updater --channel beta --platform win --include-payload`
  smoke now verify deterministic metadata, rangeable installer bytes, checksum
  serving, and payload HEAD responses for packaged-updater testing.
- Integrity #53 now unit-tests the Nix pnpm dependency hash helper's fixed-output
  hash parser and its single-hash versus upstream split-hash shape detection,
  with the test wired into `pnpm guard`.
- Governance #13 now points contributor-action links in `CONTRIBUTING.md`,
  `MAINTAINERS.md`, contributor-facing docs, and issue templates at the Tauri
  fork, while a guard keeps fork identity and Tauri-specific PR/template
  evidence in place.
- Runtime helpers #50 now have a root guard for the eight helper package
  manifests, the Tauri packaged build closure, and the absence of upstream
  Electron launcher sources from `apps/packaged`.
- Tools-dev #45 now loads workspace `.env.local` before resolving runtime
  config and pre-resolves daemon/web ports for start, run, and restart so
  split starts can preserve running ports without colliding. Upstream
  tools-pack Electron launcher changes remain intentionally unported until
  they are translated into the fork's Tauri packaging model.
- Tools-pr #45 is intentionally retained as this fork's read-only maintainer
  control plane even though upstream removes `tools/pr`; a package test now
  guards the `sunseol/opendesign-tauri` target identity and fork-local triage
  report title.
- Tools-dev/tools-pack #45 now use the upstream metatool build metadata flow:
  `meta.json` declares source inputs and bins call the shared freshness check
  before loading `dist/index.mjs`. The tools-pack metadata includes resources
  so Tauri package resource changes cannot pass through a stale dist entry.
- Daemon runtime #7 now stages Grok Build prompts through daemon-owned temp
  files for chat runs and Settings connection tests, with cleanup on spawn
  failures, cancellations, critique runs, and child exit. The sensitive PDF
  export/media-generate route guard is also installed, and the old inline
  duplicate handlers were removed after the extracted routes were verified.
  Sandbox hardening #33 now also resolves local agent profiles and executable
  search roots from daemon-owned sandbox state when `OD_SANDBOX_MODE` is set,
  preventing host `OD_AGENT_HOME` or profile config leakage into sandboxed
  runtime bootstrap. Sandbox mode also rejects imported-folder project roots
  at import, file listing, and run start while preserving project detail
  visibility for already-linked folders. Agent spawn env now pins sandbox
  homes from resolved daemon data roots, and media OAuth fallback skips host
  auth files while sandboxed. Sandboxed agent callback env also merges
  loopback NO_PROXY entries so inherited host proxies do not intercept daemon
  callbacks. Daemon project-root resolution is now shared by nested runtime
  modules so sandbox discovery paths resolve the same repo root from `src` and
  `dist` trees. Codex container deployments can also opt into
  `OD_CODEX_SANDBOX=danger-full-access` when `workspace-write` sandbox setup is
  blocked. Broader sandbox resume, registry, and route parity remains open
  under #7/#33/#48.
- Curated data #54 has upstream-identical `data/` assets and a root guard test
  for contributor/event/card linkage, plugin preview manifest shape, and the
  documented remote-only preview id set. Runtime/community rendering remains
  tracked under #23/#47.
- GitHub workflow approval remains external maintainer action; it is tracked as
  release/governance work, not as a code fix.
