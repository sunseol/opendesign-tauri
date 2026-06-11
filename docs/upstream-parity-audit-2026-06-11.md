# Upstream Parity Audit - 2026-06-11

이 문서는 `sunseol/opendesign-tauri`가 upstream `nexu-io/open-design`과 기능
parity를 맞추기 위해 등록한 GitHub issue map입니다. 결론은 단순히 14개가
아니라, 상위 트랙 14개와 구현 단위 상세 이슈 40개, 총 54개입니다.

## Baseline

- Upstream: `nexu-io/open-design@ca22620b4fa0`
- Tauri fork: `sunseol/opendesign-tauri@2265d8d43`
- Divergence: fork-only `231` commits, upstream-only `956` commits
- Diff size: `4,326` files changed, `859,775` insertions, `106,173` deletions
- Issue board: <https://github.com/sunseol/opendesign-tauri/issues>
- Gap tracker: [upstream-parity-gap-tracker-2026-06-11.md](upstream-parity-gap-tracker-2026-06-11.md)

## Audit Method

조사는 다음 근거를 함께 봤습니다.

- `git fetch upstream main --prune`
- `git rev-list --left-right --count HEAD...upstream/main`
- `git diff --shortstat HEAD..upstream/main`
- `git diff --name-only HEAD..upstream/main` path distribution
- `git log --pretty=format:%s HEAD..upstream/main` upstream PR/commit title scan
- Existing issue check in `sunseol/opendesign-tauri`

가장 큰 변경 영역은 다음과 같습니다.

| Path group | Changed files |
| --- | ---: |
| `apps/web` | 576 |
| `plugins/_official` | 492 |
| `apps/daemon` | 353 |
| `apps/landing-page` | 270 |
| `plugins/community` | 100 |
| `tools/pack` | 87 |
| `packages/contracts` | 48 |
| `.github/workflows` | 37 |
| `e2e/ui` | 36 |
| `apps/desktop` | 34 |
| `docs/i18n` | 31 |
| `apps/packaged` | 28 |
| `.github/scripts` | 27 |
| `.claude/skills` | 22 |
| `e2e/tests` | 21 |
| `tools/pr` | 20 |
| `e2e/lib` | 20 |
| `mocks/bin` | 18 |
| `packages/components` | 13 |
| `charts/open-design` | 13 |
| `tools/dev` | 12 |
| `tools/serve` | 10 |
| `packages/metatool` | 7 |
| `packages/launcher-proto` | 6 |
| `packages/download` | 6 |
| `apps/telemetry-worker` | 4 |

## Issue Map

### Umbrella Tracks

- [#1 Merge upstream main safely while preserving Tauri as default](https://github.com/sunseol/opendesign-tauri/issues/1)
- [#2 Port 0.10 Studio workspace features](https://github.com/sunseol/opendesign-tauri/issues/2)
- [#3 Port question-form, discovery, onboarding, and ask-user changes](https://github.com/sunseol/opendesign-tauri/issues/3)
- [#4 Port AMR, BYOK, model router, and provider integration upgrades](https://github.com/sunseol/opendesign-tauri/issues/4)
- [#5 Port plugin marketplace, official plugins, baked previews, and Use menu](https://github.com/sunseol/opendesign-tauri/issues/5)
- [#6 Port media generation, HyperFrames, image/video templates, and export surfaces](https://github.com/sunseol/opendesign-tauri/issues/6)
- [#7 Port daemon runtime, sandbox, MCP bundles, resume, and error recovery](https://github.com/sunseol/opendesign-tauri/issues/7)
- [#8 Port design-system 2.0, shadcn import, token contracts, and catalog updates](https://github.com/sunseol/opendesign-tauri/issues/8)
- [#9 Port web UX polish: home, workspace, composer, manual edit, toolbox](https://github.com/sunseol/opendesign-tauri/issues/9)
- [#10 Port landing, download, community, tutorials, SEO, and i18n surfaces](https://github.com/sunseol/opendesign-tauri/issues/10)
- [#11 Port analytics, telemetry, Langfuse, consent, and observability changes](https://github.com/sunseol/opendesign-tauri/issues/11)
- [#12 Port release, CI, packaging, updater, and deployment workflow changes](https://github.com/sunseol/opendesign-tauri/issues/12)
- [#13 Port contribution workflows, MCP install, templates, and repository governance assets](https://github.com/sunseol/opendesign-tauri/issues/13)
- [#14 Port desktop and packaged runtime changes while keeping Tauri as default](https://github.com/sunseol/opendesign-tauri/issues/14)

### Detailed Parity Issues

- [#15 Port Reference Board, in-app browser, capture, annotation, and comment marker flows](https://github.com/sunseol/opendesign-tauri/issues/15)
- [#16 Port artifact viewer, export, download, share, and preview reliability fixes](https://github.com/sunseol/opendesign-tauri/issues/16)
- [#17 Port Home composer, facet rails, mention picker, and prompt preset behavior](https://github.com/sunseol/opendesign-tauri/issues/17)
- [#18 Port workspace project/file management, working directory, folder import, and Design Files navigation](https://github.com/sunseol/opendesign-tauri/issues/18)
- [#19 Port automation UI, schedule picker, project picker, and tracking behavior](https://github.com/sunseol/opendesign-tauri/issues/19)
- [#20 Port CLI, MCP, agent adapter, and toolchain integration updates](https://github.com/sunseol/opendesign-tauri/issues/20)
- [#21 Port official plugin content packs, motionsites, dashboard UI, GSAP, and plugin asset cache](https://github.com/sunseol/opendesign-tauri/issues/21)
- [#22 Port plugin security, manifest validation, symlink rejection, and trusted local install rules](https://github.com/sunseol/opendesign-tauri/issues/22)
- [#23 Port community, tutorial, share-to-community, and daily digest workflows](https://github.com/sunseol/opendesign-tauri/issues/23)
- [#24 Port landing product pages, alternatives, solutions, role pages, download metadata, and SEO/blog content](https://github.com/sunseol/opendesign-tauri/issues/24)
- [#25 Port full i18n parity for 18 locales and translated docs](https://github.com/sunseol/opendesign-tauri/issues/25)
- [#26 Port design-file selection, deck/comment markers, manual editor, and inspector polish](https://github.com/sunseol/opendesign-tauri/issues/26)
- [#27 Port packaged updater, Windows update lifecycle, OD_DATA_DIR, proxy env, and OS language behavior](https://github.com/sunseol/opendesign-tauri/issues/27)
- [#28 Port release smoke, e2e P0, mock agent, visual/reporting, and CI alert coverage](https://github.com/sunseol/opendesign-tauri/issues/28)
- [#29 Port AMR runtime diagnostics, vela CLI bundle bumps, wallet/source metadata, and ACP teardown](https://github.com/sunseol/opendesign-tauri/issues/29)
- [#30 Port BYOK provider catalogs, validation, OpenRouter/AIHubMix, and model picker behavior](https://github.com/sunseol/opendesign-tauri/issues/30)
- [#31 Port analytics event families for design systems, plugins, feedback, automations, uploads, and exceptions](https://github.com/sunseol/opendesign-tauri/issues/31)
- [#32 Port Langfuse prompt-stack diagnostics, trace manifests, and object relay observability](https://github.com/sunseol/opendesign-tauri/issues/32)
- [#33 Port sandbox hardening, project-root confinement, unsafe path rejection, and artifact source guards](https://github.com/sunseol/opendesign-tauri/issues/33)
- [#34 Port official design-system 2.0 backfill batches, token contracts, and derived token outputs](https://github.com/sunseol/opendesign-tauri/issues/34)
- [#35 Port shadcn/design-system import, editing, catalog source flows, and pinning behavior](https://github.com/sunseol/opendesign-tauri/issues/35)
- [#36 Port release/governance automation for agent PR exploration, fork workflow approval, and actionlint gates](https://github.com/sunseol/opendesign-tauri/issues/36)
- [#37 Port packaged startup splash, Help menu links, hidden AMR profile menu, and desktop WSL path handling](https://github.com/sunseol/opendesign-tauri/issues/37)
- [#38 Port media provider/template additions, video generation templates, TTS, and export fidelity contract](https://github.com/sunseol/opendesign-tauri/issues/38)
- [#39 Port newsletter onboarding, welcome email, subscription CORS, and consent surfaces](https://github.com/sunseol/opendesign-tauri/issues/39)
- [#40 Port social sharing, preview URLs, share deploy completion, and public plugin detail pages](https://github.com/sunseol/opendesign-tauri/issues/40)
- [#41 Port project instructions, todo rendering, runtime stream errors, and assistant progress UI changes](https://github.com/sunseol/opendesign-tauri/issues/41)
- [#42 Port conversation resume, session continuity, queue interruption, drafts, and tab behavior](https://github.com/sunseol/opendesign-tauri/issues/42)
- [#43 Port shared API contracts, DTOs, migrations, and client/server shape changes](https://github.com/sunseol/opendesign-tauri/issues/43)
- [#44 Port shared UI primitives, design tokens, app-wide styling, and component package updates](https://github.com/sunseol/opendesign-tauri/issues/44)
- [#45 Port tools-dev, tools-pack, tools-pr, and maintainer control-plane changes](https://github.com/sunseol/opendesign-tauri/issues/45)
- [#46 Port deployment assets: Helm chart, Docker/Podman installer, cloud docs, and staging gates](https://github.com/sunseol/opendesign-tauri/issues/46)
- [#47 Port plugin preview baking, CDN/R2 cache keys, gallery performance, and packaged preview serving](https://github.com/sunseol/opendesign-tauri/issues/47)
- [#48 Port privacy/security boundary fixes for raw HTML, file links, uploads, and local path exposure](https://github.com/sunseol/opendesign-tauri/issues/48)
- [#49 Port skills, design templates, prompt templates, scenario rails, and skill-to-plugin migration helpers](https://github.com/sunseol/opendesign-tauri/issues/49)
- [#50 Port runtime helper packages: download, host, launcher-proto, metatool, diagnostics, platform, sidecar](https://github.com/sunseol/opendesign-tauri/issues/50)
- [#51 Port telemetry worker, relay configuration, public analytics params, and worker tests](https://github.com/sunseol/opendesign-tauri/issues/51)
- [#52 Port tools-serve release/updater fixtures and release metadata smoke harness](https://github.com/sunseol/opendesign-tauri/issues/52)
- [#53 Port guard, source checks, Nix hash maintenance, postinstall, and repository integrity scripts](https://github.com/sunseol/opendesign-tauri/issues/53)
- [#54 Port curated data assets: contributors, event fixtures, cards, plugin preview manifests, and catalog seed data](https://github.com/sunseol/opendesign-tauri/issues/54)

## Planning Notes

- #1 is the integration gate. Do not start large feature merges before deciding
  merge/rebase strategy and conflict handling.
- #43 should precede most web/daemon feature ports, because contract drift can
  make later UI ports appear to work while CLI/daemon shapes are wrong.
- #27, #37, and #45 are Tauri-fork critical. They must preserve Tauri as the
  default desktop runtime while absorbing upstream packaged/desktop fixes.
- #28, #33, #36, #48, #52, and #53 are validation/security gates. They should
  be treated as blockers before declaring broad parity complete.
- #49, #50, #51, #52, #53, and #54 were added after a second coverage pass
  found weak tracking around skills/templates, helper packages, telemetry,
  release fixtures, guard scripts, and curated data.
- The issue map intentionally avoids one issue per commit. Each issue is a
  user-visible or operational feature surface with its own acceptance criteria.
