# Open Design Tauri

<p align="center">
  <a href="#korean">한국어</a> · <a href="#english">English</a>
</p>

<a id="korean"></a>

## 한국어

이 저장소는 공식 `nexu-io/open-design` 저장소가 아닙니다.

`Open Design Tauri`는 Open Design의 데스크톱 런타임을 Electron 중심에서
Tauri 중심으로 옮기기 위한 개인 fork입니다. 원본 프로젝트의 핵심 제품
경험, web app, local daemon, skills, design systems, BYOK/CLI agent 흐름은
유지하면서, 데스크톱 shell과 패키징 경로를 더 작고 명확한 Tauri 기반으로
전환하는 것을 목표로 합니다.

- 원본 프로젝트: <https://github.com/nexu-io/open-design>
- 이 fork: <https://github.com/sunseol/opendesign-tauri>
- 주요 브랜치: `codex/electron-to-tauri-migration`

## 왜 별도 fork인가

원본 PR 경로에서 충돌과 review/CI 승인 문제가 반복되어, 지금까지 진행한
Electron to Tauri migration 작업물을 안정적으로 보존하고 독립적으로 이어가기
위해 별도 저장소로 백업했습니다.

이 fork는 upstream을 대체한다고 주장하지 않습니다. 목적은 명확합니다.

1. Tauri 기반 데스크톱 런타임을 실제로 유지 가능한 형태로 완성한다.
2. 기존 Open Design의 web/daemon/agent 기능은 최대한 그대로 유지한다.
3. Electron 의존을 즉시 삭제하지 않고, 전환 기간 동안 명시적 fallback으로만 둔다.
4. macOS, Windows, Linux 패키징 흐름을 Tauri 기준으로 검증한다.

## 원본과 다른 점

| 영역 | 원본 Open Design | 이 fork |
| --- | --- | --- |
| Desktop runtime | Electron 중심 또는 Electron 호환 경로 중심 | Tauri를 기본 desktop runtime으로 사용 |
| Electron | 기본 shell 역할 또는 강한 fallback 역할 | 전환 기간의 명시적 fallback으로 유지 |
| Tauri | migration/검증 대상 | 기본 실행 및 패키징 대상 |
| Packaging | Electron builder 중심 흐름 포함 | `tools-pack`에서 Tauri mac/Windows/Linux 경로를 우선 사용 |
| Desktop IPC | desktop shell과 sidecar IPC | Tauri shell에서도 같은 STATUS/EVAL/SCREENSHOT/CONSOLE/CLICK/SHUTDOWN 계층 유지 |
| 목적 | 공식 Open Design 제품 개발 | Tauri 전환 작업물 보존 및 독립 검증 |

## 무엇을 옮겼나

이 브랜치의 핵심 작업은 "앱을 새로 만드는 것"이 아니라, 기존 Open Design의
제품 구조를 유지한 채 desktop shell을 Tauri로 바꾸는 것입니다.

주요 변경 범위는 다음과 같습니다.

- `apps/desktop/src-tauri/` 기반 Tauri desktop runtime 추가 및 연결
- `tools-dev`와 `tools-pack`의 desktop runtime 기본값을 Tauri로 전환
- Electron runtime은 삭제하지 않고 `--desktop-runtime electron` 같은 명시적
  선택 경로로 유지
- macOS Tauri app/DMG, Windows NSIS, Linux AppImage 패키징 경로 추가
- Tauri packaged app에서 daemon/web sidecar와 runtime resource를 함께 다루는
  패키징 흐름 정리
- desktop inspection IPC 유지:
  `status`, `eval`, `screenshot`, `console`, `click`, `shutdown`
- migration guard, status, handoff, platform evidence 스크립트 추가
- Tauri build output이 git에 섞이지 않도록 `.gitignore` 정리:
  `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/target/`

## 왜 Tauri가 더 나은가

Open Design은 본질적으로 web UI와 local daemon이 제품의 중심입니다. Desktop
shell은 "제품 전체"라기보다 web UI를 안전하게 띄우고, daemon과 sidecar 상태를
관리하는 얇은 host에 가깝습니다. 이 구조에서는 Electron보다 Tauri가 더 잘
맞습니다.

### 1. 더 얇은 desktop shell

Electron은 Chromium과 Node runtime을 desktop shell 안에 크게 포함합니다.
Open Design은 이미 web app과 daemon이 분리되어 있으므로, desktop shell이
무거운 browser runtime 전체를 소유할 필요가 적습니다.

Tauri는 OS webview와 Rust 기반 shell을 사용하므로 desktop host를 더 얇게
유지하기 좋습니다. 이 fork의 방향은 desktop shell을 "작은 native wrapper"로
만들고, 실제 제품 로직은 기존 web/daemon 계층에 남기는 것입니다.

### 2. 보안 경계가 더 선명함

Open Design은 로컬 파일, agent CLI, project workspace, packaged sidecar를
다룹니다. 그래서 privileged 작업은 daemon에 집중되어야 하고, UI shell은 가능한
좁은 권한만 가져야 합니다.

Tauri 전환은 이 경계를 더 명확히 합니다.

- web UI는 사용자 경험과 preview를 담당
- daemon은 filesystem, agent spawn, SQLite, API를 담당
- Tauri shell은 web URL discovery와 desktop lifecycle을 담당
- sidecar IPC는 typed stamp와 namespace를 통해 daemon/web/desktop을 연결

### 3. 기존 제품 경험을 버리지 않음

이 migration은 UI rewrite가 아닙니다. Open Design의 핵심 루프는 그대로입니다.

- skills 기반 artifact generation
- design systems
- local project workspace
- BYOK/API proxy
- coding-agent CLI integration
- sandboxed artifact preview
- persistent conversations and files

즉, 사용자가 보는 Open Design의 핵심 경험은 유지하고, desktop delivery layer만
Tauri 쪽으로 이동합니다.

### 4. 패키징과 배포 경로가 단순해짐

이 fork는 packaged desktop app을 Tauri 기준으로 다룹니다.

- macOS: app bundle, DMG
- Windows: NSIS installer
- Linux: AppImage

Electron artifacts는 전환 기간의 fallback으로 남겨 두되, 기본 검증과 문서의
방향은 Tauri를 기준으로 정리합니다.

### 5. 장기 유지보수 비용을 줄이는 방향

Electron을 계속 기본 runtime으로 두면 desktop shell, packaging, update,
native resource 처리, Electron builder 설정이 계속 주요 유지보수 표면이 됩니다.

Tauri 전환은 desktop host를 작게 만들고, 제품 로직을 이미 존재하는 web/daemon
경계에 남겨 유지보수 표면을 줄이는 방향입니다. 이 fork의 핵심 판단은 다음입니다.

> Open Design의 차별점은 Electron shell이 아니라, local daemon + agent +
> skills + design systems loop다.

## 현재 상태

현재 브랜치 기준으로 Tauri는 기본 desktop runtime입니다. Electron은 완전히
삭제하지 않았고, 명시적 fallback으로 남겨 두었습니다.

검증에 사용한 주요 명령은 다음과 같습니다.

```bash
pnpm install
pnpm guard
pnpm typecheck
pnpm --filter @open-design/e2e typecheck
pnpm exec tsx scripts/tauri-migration-inventory.ts --json
```

branch conflict를 최신 main과 맞추면서 추가로 확인한 항목:

```bash
git diff --check
pnpm --filter @open-design/contracts build
```

## 원본 기능 parity 계획

이 fork의 본질은 "기능이 줄어든 Open Design"이 아니라 "Open Design의 Tauri
버전"입니다. 따라서 최종 목표는 upstream `nexu-io/open-design`과 사용자 기능
차이가 없도록 맞추는 것입니다. 차이는 desktop delivery layer에만 있어야 하며,
기본 desktop runtime은 Tauri로 유지합니다.

2026-06-11 parity audit 기준:

- 원본 기준점: `nexu-io/open-design@ca22620b4`
- 이 fork 기준점: `sunseol/opendesign-tauri@072fa2323b31`
- 차이 규모: upstream-only `956` commits, 약 `4,325` changed files
- 추적 위치: <https://github.com/sunseol/opendesign-tauri/issues>

동기화 원칙:

1. upstream 기능은 누락하지 않는다.
2. Tauri를 기본 desktop runtime으로 유지한다.
3. Electron은 검증된 Tauri 경로가 완성될 때까지 명시적 fallback으로만 둔다.
4. web, daemon, skills, design systems, BYOK, plugin, media, release 기능은
   upstream과 같은 수준으로 맞춘다.
5. 큰 upstream 차이는 한 번에 섞지 않고 기능군별 이슈로 나누어 검증한다.

등록한 parity 이슈:

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

권장 동기화 순서:

1. [#1](https://github.com/sunseol/opendesign-tauri/issues/1)에서 upstream
   merge/rebase 전략과 충돌 정책을 먼저 확정한다.
2. [#7](https://github.com/sunseol/opendesign-tauri/issues/7),
   [#12](https://github.com/sunseol/opendesign-tauri/issues/12),
   [#14](https://github.com/sunseol/opendesign-tauri/issues/14)로 daemon,
   CI/release, packaged desktop 기반을 먼저 맞춘다.
3. [#2](https://github.com/sunseol/opendesign-tauri/issues/2),
   [#3](https://github.com/sunseol/opendesign-tauri/issues/3),
   [#4](https://github.com/sunseol/opendesign-tauri/issues/4)로 Studio,
   onboarding/question flow, AMR/BYOK 기능을 맞춘다.
4. [#5](https://github.com/sunseol/opendesign-tauri/issues/5),
   [#6](https://github.com/sunseol/opendesign-tauri/issues/6),
   [#8](https://github.com/sunseol/opendesign-tauri/issues/8)로 plugin,
   media, design-system 기능을 맞춘다.
5. [#9](https://github.com/sunseol/opendesign-tauri/issues/9),
   [#10](https://github.com/sunseol/opendesign-tauri/issues/10),
   [#11](https://github.com/sunseol/opendesign-tauri/issues/11),
   [#13](https://github.com/sunseol/opendesign-tauri/issues/13)로 web UX,
   landing/community, observability, contributor workflow를 정리한다.

## 로컬 실행

Node.js `~24`와 `pnpm@10.33.2`를 사용합니다.

```bash
corepack enable
pnpm install
pnpm tools-dev
```

상태 확인:

```bash
pnpm tools-dev status --json
pnpm tools-dev inspect desktop status --json
```

desktop screenshot:

```bash
pnpm tools-dev inspect desktop screenshot --path /tmp/open-design-tauri.png
```

Electron fallback이 필요한 경우:

```bash
pnpm tools-dev --desktop-runtime electron
```

## 패키징

Tauri 기준 패키징 명령:

```bash
pnpm tools-pack mac build --to all
pnpm tools-pack win build --to nsis
pnpm tools-pack linux build --to appimage
```

설치/정리:

```bash
pnpm tools-pack mac install
pnpm tools-pack mac cleanup

pnpm tools-pack win install
pnpm tools-pack win cleanup

pnpm tools-pack linux install
pnpm tools-pack linux cleanup
```

## 남은 일

이 fork는 migration worktree를 보존하기 위한 저장소이므로, 아래 항목은 계속
검증해야 합니다.

- upstream main과의 지속적인 충돌 관리
- GitHub Actions fork approval 이후 실제 CI 결과 확인
- macOS, Windows, Linux 실기기 smoke evidence 최신화
- Electron fallback 유지 범위 축소
- Electron 전용 packaging code의 최종 정리 여부 결정
- public release channel 이름, updater feed, installer identity 재검토

## 개발 원칙

이 fork에서 중요한 원칙은 세 가지입니다.

1. Tauri를 기본으로 둔다.
2. Open Design의 web/daemon/agent 제품 구조는 보존한다.
3. Electron은 전환을 위한 fallback이지, 장기 기본값이 아니다.

## Attribution

이 저장소는 `nexu-io/open-design`의 fork에서 출발했습니다. 원본 프로젝트와
기여자들의 작업을 기반으로 하며, 이 README는 Tauri migration fork의 목적과
차이를 설명하기 위해 별도로 작성되었습니다.

License는 원본과 동일하게 Apache-2.0을 따릅니다.

<p align="right"><a href="#open-design-tauri">Back to top</a></p>

<a id="english"></a>

## English

This repository is not the official `nexu-io/open-design` repository.

`Open Design Tauri` is a personal fork for moving Open Design's desktop
runtime from an Electron-centered path to a Tauri-centered path. The goal is to
keep the core product experience intact, including the web app, local daemon,
skills, design systems, and BYOK/CLI agent flow, while making the desktop shell
and packaging path smaller and clearer through Tauri.

- Upstream project: <https://github.com/nexu-io/open-design>
- This fork: <https://github.com/sunseol/opendesign-tauri>
- Main working branch: `codex/electron-to-tauri-migration`

## Why this fork exists

The original PR path repeatedly hit merge conflicts and review/CI approval
blocks. This repository backs up the Electron to Tauri migration work so it can
continue independently and safely.

This fork does not claim to replace upstream. Its purpose is narrower:

1. Finish a maintainable Tauri-based desktop runtime.
2. Keep the existing Open Design web/daemon/agent behavior as intact as possible.
3. Keep Electron as an explicit transition fallback instead of deleting it at once.
4. Validate macOS, Windows, and Linux packaging through the Tauri path.

## What is different from upstream

| Area | Upstream Open Design | This fork |
| --- | --- | --- |
| Desktop runtime | Electron-centered or Electron-compatible path | Tauri is the default desktop runtime |
| Electron | Default shell or strong fallback role | Explicit transition fallback |
| Tauri | Migration and validation target | Default run and packaging target |
| Packaging | Includes Electron builder-centered flows | Prioritizes Tauri mac/Windows/Linux flows in `tools-pack` |
| Desktop IPC | Desktop shell plus sidecar IPC | The Tauri shell keeps the same STATUS/EVAL/SCREENSHOT/CONSOLE/CLICK/SHUTDOWN layer |
| Purpose | Official Open Design product development | Preserve and independently validate the Tauri migration line |

## What was migrated

The work on this branch is not a product rewrite. It keeps the existing Open
Design product structure and moves the desktop shell toward Tauri.

Main migration areas:

- Add and wire a Tauri desktop runtime under `apps/desktop/src-tauri/`
- Flip `tools-dev` and `tools-pack` desktop runtime defaults to Tauri
- Keep Electron as an explicit fallback, for example `--desktop-runtime electron`
- Add macOS Tauri app/DMG, Windows NSIS, and Linux AppImage packaging paths
- Organize Tauri packaged app handling for daemon/web sidecars and runtime resources
- Preserve desktop inspection IPC:
  `status`, `eval`, `screenshot`, `console`, `click`, `shutdown`
- Add migration guard, status, handoff, and platform evidence scripts
- Keep Tauri build output out of git:
  `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/target/`

## Why Tauri is better for this project

Open Design is centered on a web UI and a local daemon. The desktop shell is not
the whole product; it is a thin host that opens the web UI and coordinates daemon
and sidecar state. That shape fits Tauri better than Electron.

### 1. A thinner desktop shell

Electron brings a large Chromium and Node runtime into the desktop shell. Open
Design already separates the web app from the daemon, so the desktop host does
not need to own a full heavy browser runtime.

Tauri uses the OS webview and a Rust native shell, which keeps the desktop host
smaller. This fork treats the desktop app as a small native wrapper while the
real product logic stays in the existing web/daemon layers.

### 2. Clearer security boundaries

Open Design touches local files, agent CLIs, project workspaces, and packaged
sidecars. Privileged work should stay concentrated in the daemon, while the UI
shell should hold as little authority as possible.

The Tauri migration makes that boundary clearer:

- The web UI owns the user experience and preview surface
- The daemon owns filesystem access, agent spawn, SQLite, and APIs
- The Tauri shell owns web URL discovery and desktop lifecycle
- Sidecar IPC connects daemon, web, and desktop through typed stamps and namespaces

### 3. The product experience stays intact

This migration is not a UI rewrite. The core Open Design loop remains:

- skill-based artifact generation
- design systems
- local project workspace
- BYOK/API proxy
- coding-agent CLI integration
- sandboxed artifact preview
- persistent conversations and files

The user-facing Open Design experience stays in place. The delivery layer moves
from Electron toward Tauri.

### 4. Simpler packaging and delivery

This fork treats packaged desktop builds as Tauri-first:

- macOS: app bundle, DMG
- Windows: NSIS installer
- Linux: AppImage

Electron artifacts remain as transition fallback paths, but the default
validation and documentation direction is Tauri.

### 5. Lower long-term maintenance cost

Keeping Electron as the default makes the desktop shell, packaging, update,
native resource handling, and Electron builder configuration a large permanent
maintenance surface.

The Tauri direction keeps the desktop host smaller and leaves product logic in
the already existing web/daemon boundary. The core judgment behind this fork is:

> Open Design's value is not the Electron shell. It is the local daemon + agent +
> skills + design systems loop.

## Current status

On this branch, Tauri is the default desktop runtime. Electron has not been fully
removed; it remains as an explicit fallback.

Main verification commands used during the migration:

```bash
pnpm install
pnpm guard
pnpm typecheck
pnpm --filter @open-design/e2e typecheck
pnpm exec tsx scripts/tauri-migration-inventory.ts --json
```

Additional checks used while resolving main-branch conflicts:

```bash
git diff --check
pnpm --filter @open-design/contracts build
```

## Upstream parity plan

This fork is not meant to be a reduced-functionality Open Design. It is meant
to become the Tauri version of Open Design. The final target is no user-facing
feature gap with upstream `nexu-io/open-design`; the difference should stay in
the desktop delivery layer, with Tauri as the default desktop runtime.

Parity audit baseline from 2026-06-11:

- Upstream baseline: `nexu-io/open-design@ca22620b4`
- Fork baseline: `sunseol/opendesign-tauri@072fa2323b31`
- Gap size: upstream-only `956` commits and about `4,325` changed files
- Tracking board: <https://github.com/sunseol/opendesign-tauri/issues>

Sync principles:

1. Do not leave upstream features behind.
2. Keep Tauri as the default desktop runtime.
3. Keep Electron only as an explicit fallback until equivalent Tauri paths are
   proven.
4. Bring web, daemon, skills, design systems, BYOK, plugin, media, and release
   capabilities back to upstream parity.
5. Split the large upstream delta into feature-area issues instead of mixing it
   all into one change.

Opened parity issues:

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

Recommended sync order:

1. Use [#1](https://github.com/sunseol/opendesign-tauri/issues/1) to settle the
   upstream merge/rebase strategy and conflict policy first.
2. Use [#7](https://github.com/sunseol/opendesign-tauri/issues/7),
   [#12](https://github.com/sunseol/opendesign-tauri/issues/12), and
   [#14](https://github.com/sunseol/opendesign-tauri/issues/14) to align daemon,
   CI/release, and packaged desktop foundations.
3. Use [#2](https://github.com/sunseol/opendesign-tauri/issues/2),
   [#3](https://github.com/sunseol/opendesign-tauri/issues/3), and
   [#4](https://github.com/sunseol/opendesign-tauri/issues/4) to align Studio,
   onboarding/question flow, and AMR/BYOK features.
4. Use [#5](https://github.com/sunseol/opendesign-tauri/issues/5),
   [#6](https://github.com/sunseol/opendesign-tauri/issues/6), and
   [#8](https://github.com/sunseol/opendesign-tauri/issues/8) to align plugin,
   media, and design-system capabilities.
5. Use [#9](https://github.com/sunseol/opendesign-tauri/issues/9),
   [#10](https://github.com/sunseol/opendesign-tauri/issues/10),
   [#11](https://github.com/sunseol/opendesign-tauri/issues/11), and
   [#13](https://github.com/sunseol/opendesign-tauri/issues/13) to finish web
   UX, landing/community, observability, and contributor workflows.

## Local development

Use Node.js `~24` and `pnpm@10.33.2`.

```bash
corepack enable
pnpm install
pnpm tools-dev
```

Check status:

```bash
pnpm tools-dev status --json
pnpm tools-dev inspect desktop status --json
```

Capture a desktop screenshot:

```bash
pnpm tools-dev inspect desktop screenshot --path /tmp/open-design-tauri.png
```

Use the Electron fallback only when needed:

```bash
pnpm tools-dev --desktop-runtime electron
```

## Packaging

Tauri-first packaging commands:

```bash
pnpm tools-pack mac build --to all
pnpm tools-pack win build --to nsis
pnpm tools-pack linux build --to appimage
```

Install and cleanup:

```bash
pnpm tools-pack mac install
pnpm tools-pack mac cleanup

pnpm tools-pack win install
pnpm tools-pack win cleanup

pnpm tools-pack linux install
pnpm tools-pack linux cleanup
```

## Remaining work

This repository preserves the migration worktree, so these areas still need
ongoing validation:

- Keep resolving drift from upstream `main`
- Confirm real CI results after GitHub Actions fork approval
- Refresh macOS, Windows, and Linux smoke evidence on real platforms
- Narrow the Electron fallback surface
- Decide how much Electron-only packaging code should remain
- Re-check public release channel names, updater feeds, and installer identity

## Development principles

Three principles guide this fork:

1. Tauri is the default.
2. The Open Design web/daemon/agent structure stays intact.
3. Electron is a transition fallback, not the long-term default.

## Attribution

This repository started as a fork of `nexu-io/open-design`. It builds on the
work of the upstream project and its contributors. This README was rewritten to
explain the purpose and differences of the Tauri migration fork.

The license remains Apache-2.0, matching upstream.

<p align="right"><a href="#open-design-tauri">Back to top</a></p>
