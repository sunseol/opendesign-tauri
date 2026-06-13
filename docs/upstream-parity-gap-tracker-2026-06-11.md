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
| Daemon/runtime/API | `apps/daemon` 353 files | [#7](https://github.com/sunseol/opendesign-tauri/issues/7), [#20](https://github.com/sunseol/opendesign-tauri/issues/20), [#29](https://github.com/sunseol/opendesign-tauri/issues/29), [#30](https://github.com/sunseol/opendesign-tauri/issues/30), [#33](https://github.com/sunseol/opendesign-tauri/issues/33), [#43](https://github.com/sunseol/opendesign-tauri/issues/43), [#48](https://github.com/sunseol/opendesign-tauri/issues/48) | Not started |
| Contracts/shared DTOs | `packages/contracts` 48 files | [#43](https://github.com/sunseol/opendesign-tauri/issues/43) | Not started |
| Shared UI package | `packages/components` 13 files | [#44](https://github.com/sunseol/opendesign-tauri/issues/44) | Not started |
| Design systems | `design-systems` 1,666 files | [#8](https://github.com/sunseol/opendesign-tauri/issues/8), [#34](https://github.com/sunseol/opendesign-tauri/issues/34), [#35](https://github.com/sunseol/opendesign-tauri/issues/35) | Not started |
| Plugins and marketplace | `plugins` 596 files | [#5](https://github.com/sunseol/opendesign-tauri/issues/5), [#21](https://github.com/sunseol/opendesign-tauri/issues/21), [#22](https://github.com/sunseol/opendesign-tauri/issues/22), [#47](https://github.com/sunseol/opendesign-tauri/issues/47) | Not started |
| Skills/templates/prompts | `skills` 94 files, `design-templates` 23 files, `prompt-templates` 5 files | [#49](https://github.com/sunseol/opendesign-tauri/issues/49), [#38](https://github.com/sunseol/opendesign-tauri/issues/38), [#21](https://github.com/sunseol/opendesign-tauri/issues/21) | Not started |
| Landing/community/docs | `apps/landing-page` 270 files, `plugins/community` 100 files, `docs` 78 files | [#10](https://github.com/sunseol/opendesign-tauri/issues/10), [#23](https://github.com/sunseol/opendesign-tauri/issues/23), [#24](https://github.com/sunseol/opendesign-tauri/issues/24), [#25](https://github.com/sunseol/opendesign-tauri/issues/25), [#39](https://github.com/sunseol/opendesign-tauri/issues/39), [#40](https://github.com/sunseol/opendesign-tauri/issues/40), [#54](https://github.com/sunseol/opendesign-tauri/issues/54) | Not started |
| Desktop and packaged runtime | `apps/desktop` 34 files, `apps/packaged` 28 files | [#14](https://github.com/sunseol/opendesign-tauri/issues/14), [#27](https://github.com/sunseol/opendesign-tauri/issues/27), [#37](https://github.com/sunseol/opendesign-tauri/issues/37), [#50](https://github.com/sunseol/opendesign-tauri/issues/50) | Not started |
| Release, CI, tools, fixtures | `.github` 88 files, `tools/pack` 87 files, `tools/pr` 20 files, `tools/serve` 10 files | [#12](https://github.com/sunseol/opendesign-tauri/issues/12), [#28](https://github.com/sunseol/opendesign-tauri/issues/28), [#36](https://github.com/sunseol/opendesign-tauri/issues/36), [#45](https://github.com/sunseol/opendesign-tauri/issues/45), [#52](https://github.com/sunseol/opendesign-tauri/issues/52), [#53](https://github.com/sunseol/opendesign-tauri/issues/53) | Not started |
| Analytics and observability | contracts + web + daemon + telemetry worker | [#11](https://github.com/sunseol/opendesign-tauri/issues/11), [#31](https://github.com/sunseol/opendesign-tauri/issues/31), [#32](https://github.com/sunseol/opendesign-tauri/issues/32), [#51](https://github.com/sunseol/opendesign-tauri/issues/51) | In progress - telemetry worker health, object-relay fail-closed path, IP throttling, token-required schema checks, and signed R2 write path covered |
| Deployment assets | `charts`, `deploy`, deployment docs | [#46](https://github.com/sunseol/opendesign-tauri/issues/46) | Not started |
| Curated data | `data` 4 files | [#54](https://github.com/sunseol/opendesign-tauri/issues/54), [#47](https://github.com/sunseol/opendesign-tauri/issues/47), [#23](https://github.com/sunseol/opendesign-tauri/issues/23) | In progress - data seed imported; packaged plugin-preview manifest path covered |

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
  upload tokens, and writes authorized objects through the R2 binding. The
  `/api/objects/authorize` endpoint and trace-scope registration remain open
  under #32/#51.
- GitHub workflow approval remains external maintainer action; it is tracked as
  release/governance work, not as a code fix.
