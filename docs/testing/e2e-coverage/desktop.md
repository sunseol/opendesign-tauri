# 桌面端模块

## 覆盖范围

- 受环境变量控制的 mac 桌面端 smoke
- mac 打包产物安装/启动/探活生命周期
- Windows 打包产物安装/启动/探活生命周期
- Linux Tauri AppImage 与 headless 打包运行时生命周期
- 从 desktop shell 进入设置页的关键路径

## 对应测试文件

- `e2e/specs/mac.spec.ts`
- `e2e/specs/win.spec.ts`
- `e2e/specs/win-tauri.spec.ts`
- `e2e/specs/linux.spec.ts`

## 已自动化

### Desktop shell smoke

| ID | 场景 | Gate | 来源 |
| --- | --- | --- | --- |
| DESK-001 | Desktop shell 可以打开当前 API 配置，并展示正确的 provider/model | `OD_DESKTOP_SMOKE=1` | `mac.spec.ts` |
| DESK-002 | 在桌面端设置里切换 API protocol 时，legacy provider tracking 保持一致 | `OD_DESKTOP_SMOKE=1` | `mac.spec.ts` |
| DESK-003 | 桌面端外观设置里预览 Dark 模式，并在保存后持久化 | `OD_DESKTOP_SMOKE=1` | `mac.spec.ts` |

### 打包运行时 smoke

| ID | 场景 | Gate | 来源 |
| --- | --- | --- | --- |
| DESK-101 | 构建出的 mac 安装包可以完成安装、启动、健康检查、停止和卸载 | `OD_PACKAGED_E2E_MAC=1` | `mac.spec.ts` |
| DESK-102 | 构建出的 Windows NSIS 安装包可以完成安装、启动、健康检查、停止和卸载 | `OD_PACKAGED_E2E_WIN=1` | `win.spec.ts` |
| DESK-103 | 构建出的 Windows Tauri NSIS 安装包可以完成 build/install/start/inspect/screenshot/stop/uninstall | `OD_PACKAGED_E2E_WIN_TAURI=1` | `win-tauri.spec.ts` |
| DESK-104 | 构建出的 Linux Tauri AppImage 可以完成 build/install/start/inspect/screenshot/stop/uninstall，且 headless 入口仍可 start/stop | `OD_PACKAGED_E2E_LINUX=1` | `linux.spec.ts` |

## #27 Packaged Runtime Update Matrix

| Platform | Gate | 自动化证据 | 更新/不支持范围 |
| --- | --- | --- | --- |
| `macOS` | `OD_PACKAGED_E2E_MAC=1` | `e2e/specs/mac.spec.ts` installs the packaged app, waits for the updater fixture to reach `downloaded`, verifies `downloadPath`, shows the updater popup, clicks the install handoff in dry-run mode, captures logs/screenshot, then stops and uninstalls. | DMG/install handoff is covered by the packaged smoke. Live notarized replacement is an environment-owned release check outside this CI gate. |
| `Windows` | `OD_PACKAGED_E2E_WIN=1` | `e2e/specs/win.spec.ts` runs Windows NSIS update/reinstall coverage: install/start/health, updater popup, `downloadPath` under the installed update root, installer handoff dry-run, direct reinstall while running, restart, screenshot, logs, stop, uninstall, and residue checks. | NSIS updater and reinstall lifecycle are covered by the Windows packaged smoke; `OD_PACKAGED_E2E_WIN_VERIFY_REINSTALL=0` may skip the direct reinstall probe only when the host cannot run that side effect. |
| `Linux` | `OD_PACKAGED_E2E_LINUX=1` | `e2e/specs/linux.spec.ts` builds the Tauri AppImage, installs, starts, inspects health/eval/screenshot, stops, uninstalls, and rechecks the headless launcher lifecycle. CI publishes this through `packaged_smoke_tauri_linux`. | AppImage updater install handoff is one of the explicitly documented unsupported update paths for #27; Linux currently owns packaged lifecycle evidence, not self-update replacement. |

The Windows Tauri migration gate remains separate in `e2e/specs/win-tauri.spec.ts` under
`OD_PACKAGED_E2E_WIN_TAURI=1`. CI wires Windows and Linux native package gates through
`packaged_smoke_tauri_win` and `packaged_smoke_tauri_linux`.

Packaged sidecars inherit the environment needed for #27 runtime parity:

- `OD_DATA_DIR` is honored as a namespace-scoped packaged data root; already-scoped values are preserved, and relative or mismatched namespace paths are rejected by `apps/packaged/tests/paths.test.ts`.
- Node proxy variables are forwarded to sidecars: `NODE_USE_ENV_PROXY`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `http_proxy`, `https_proxy`, and `no_proxy`.
- Host OS language signals are forwarded through `LANG` and `LC_ALL`, so packaged sidecars observe the same host OS language inputs as the desktop shell.

## 自动化候选

| ID | 场景 | 原因 |
| --- | --- | --- |
| DESK-C01 | Windows desktop smoke | 值得补，但要等桌面 shell 在 Windows 上的常规 dev/runtime smoke 基础设施准备好 |
| DESK-C02 | 更多桌面端设置分区，例如 notifications、language、connectors | 有自动化价值，但当前先保留高 ROI 核心路径 |
| DESK-C03 | 更深入的 packaged runtime 校验 | 成本较高，适合在发布链路更稳定后逐步扩展 |

## 手工保留

| ID | 场景 | 原因 |
| --- | --- | --- |
| DESK-M01 | 真机安装体验、系统权限弹窗体验 | 强依赖真实机器环境和人工判断 |
| DESK-M02 | 不同 macOS 版本下的界面细节与交互质感 | 自动化覆盖成本高，更适合人工回归 |

## 说明

- 桌面端 mac smoke 有意折叠进 `e2e/specs/mac.spec.ts`，这样可执行覆盖仍然留在现有平台 smoke 层里。
- `e2e/specs/win-tauri.spec.ts` 是 Tauri 迁移平台门禁，避免复用 Electron NSIS spec 里的 Electron-specific direct reinstall assertions。
- `e2e/specs/linux.spec.ts` 是 Tauri 迁移平台门禁；默认 skip，只在 Linux host 且 `OD_PACKAGED_E2E_LINUX=1` 时执行。
- CI 的 `packaged_smoke_tauri_win` 和 `packaged_smoke_tauri_linux` job 会在 packaging 相关改动时运行上述两个 Tauri 迁移门禁，并上传 release-smoke report artifact。
- `e2e/lib/desktop/**` 只放 helper，不放独立可执行用例。
