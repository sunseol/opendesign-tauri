import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  APP_KEYS,
  SIDECAR_MESSAGES,
  SIDECAR_STAMP_FIELDS,
  SIDECAR_STAMP_FLAGS,
} from "@open-design/sidecar-proto";

const rustSource = readFileSync(new URL("../../src-tauri/src/main.rs", import.meta.url), "utf8");
const desktopMenuUrl = new URL("../../src-tauri/src/desktop_menu.rs", import.meta.url);
const desktopMenuSource = existsSync(desktopMenuUrl) ? readFileSync(desktopMenuUrl, "utf8") : "";
const amrProfileUrl = new URL("../../src-tauri/src/amr_profile.rs", import.meta.url);
const amrProfileSource = existsSync(amrProfileUrl) ? readFileSync(amrProfileUrl, "utf8") : "";
const desktopShellSource = `${rustSource}\n${desktopMenuSource}\n${amrProfileSource}`;
const cargoToml = readFileSync(new URL("../../src-tauri/Cargo.toml", import.meta.url), "utf8");
const defaultCapability = JSON.parse(
  readFileSync(new URL("../../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
) as {
  permissions?: string[];
  remote?: {
    urls?: string[];
  };
};
const tauriConfig = JSON.parse(readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8")) as {
  app?: {
    withGlobalTauri?: boolean;
  };
};
const pendingHtml = readFileSync(new URL("../../src-tauri/static/pending.html", import.meta.url), "utf8");
const splashVideoUrl = new URL("../../src-tauri/static/splash.mp4", import.meta.url);

describe("Tauri sidecar contract constants", () => {
  it("keeps app keys and message names aligned with sidecar-proto", () => {
    for (const value of Object.values(APP_KEYS)) {
      expect(rustSource).toContain(`"${value}"`);
    }
    for (const value of Object.values(SIDECAR_MESSAGES)) {
      expect(rustSource).toContain(`"${value}"`);
    }
  });

  it("keeps stamp fields and flags aligned with sidecar-proto", () => {
    for (const field of SIDECAR_STAMP_FIELDS) {
      expect(rustSource).toContain(`"${field}"`);
    }
    for (const flag of Object.values(SIDECAR_STAMP_FLAGS)) {
      expect(rustSource).toContain(`"${flag}"`);
    }
  });

  it("accepts inline and split sidecar stamp flags", () => {
    expect(rustSource).toContain('let inline_prefix = format!("{flag}=");');
    expect(rustSource).toContain("argument == flag");
    expect(rustSource).toContain("strip_prefix(&inline_prefix)");
  });

  it("normalizes Windows verbatim paths before handing bundled helpers to Node", () => {
    expect(rustSource).toContain("const WINDOWS_VERBATIM_PREFIX");
    expect(rustSource).toContain("fn node_compatible_path(path: &Path) -> PathBuf");
    expect(rustSource).toContain("let helper_path_for_node = node_compatible_path(&helper_path);");
    expect(rustSource).toContain(".arg(helper_path_for_node)");
    expect(rustSource).toContain(".env(TAURI_RESOURCE_DIR_ENV, resource_dir_for_node)");
  });

  it("routes WSL open-path requests through Windows Explorer", () => {
    expect(rustSource).toContain("fn is_wsl_release");
    expect(rustSource).toContain("fn open_validated_directory(path: &Path) -> String");
    expect(rustSource).toContain('Command::new("wslpath")');
    expect(rustSource).toContain('.arg("-w")');
    expect(rustSource).toContain('Command::new("explorer.exe")');
    expect(rustSource).toContain("open_validated_directory(&resolved)");
  });

  it("installs native desktop Help menu links", () => {
    expect(desktopShellSource).toContain("MenuBuilder");
    expect(desktopShellSource).toContain("SubmenuBuilder");
    expect(desktopShellSource).toContain('SubmenuBuilder::new(app_handle, "Help")');
    expect(desktopShellSource).toContain('"Documentation"');
    expect(desktopShellSource).toContain('"Contact Us"');
    expect(desktopShellSource).toContain('"Report Issue"');
    expect(desktopShellSource).toContain('"Join Discord"');
    expect(desktopShellSource).toContain('"https://github.com/sunseol/opendesign-tauri#readme"');
    expect(desktopShellSource).toContain('"https://github.com/sunseol/opendesign-tauri/issues/new"');
    expect(desktopShellSource).toContain('"https://x.com/nexudotio"');
    expect(desktopShellSource).toContain('"https://discord.gg/mHAjSMV6gz"');
    expect(desktopShellSource).toContain("on_menu_event");
  });

  it("keeps JSON IPC response envelopes aligned with sidecar runtime framing", () => {
    expect(rustSource).toContain('json!({ "ok": true, "result": result })');
    expect(rustSource).toContain('json!({ "ok": false, "error": { "message": message.into() } })');
  });

  it("allows Tauri command IPC from the local web sidecar URL", () => {
    expect(defaultCapability.remote?.urls).toEqual(
      expect.arrayContaining(["http://127.0.0.1:*/**", "http://localhost:*/**"]),
    );
    expect(defaultCapability.permissions).toEqual(
      expect.arrayContaining([
        "allow-desktop-inspect-eval-result",
        "allow-desktop-open-external",
        "allow-desktop-open-project-path",
        "allow-desktop-pick-and-import",
      ]),
    );
    expect(tauriConfig.app?.withGlobalTauri).toBe(true);
  });

  it("shows the packaged startup splash video on a white background", () => {
    expect(pendingHtml).toContain("background: #f2f4f5");
    expect(pendingHtml).toContain("<video");
    expect(pendingHtml).toContain('id="splash"');
    expect(pendingHtml).toContain("autoplay");
    expect(pendingHtml).toContain("muted");
    expect(pendingHtml).toContain("playsinline");
    expect(pendingHtml).toContain("disablepictureinpicture");
    expect(pendingHtml).toContain('src="splash.mp4"');
    expect(pendingHtml).toContain("loadedmetadata");
    expect(pendingHtml).toContain("loadeddata");
    expect(existsSync(splashVideoUrl)).toBe(true);

    const splashVideo = readFileSync(splashVideoUrl);
    expect(splashVideo.subarray(4, 8).toString("ascii")).toBe("ftyp");
    expect(splashVideo.byteLength).toBeGreaterThan(100_000);
  });

  it("keeps the AMR profile menu hidden behind the desktop shortcut", () => {
    expect(cargoToml).toContain('tauri-plugin-global-shortcut = "2.3.2"');
    expect(desktopMenuSource).toContain("GlobalShortcutExt");
    expect(desktopMenuSource).toContain("ShortcutState::Pressed");
    expect(desktopMenuSource).toContain("develop_menu_visible");
    expect(desktopMenuSource).toContain("AMR Profile");
    expect(desktopShellSource).toContain("amr-profile-prod");
    expect(desktopShellSource).toContain("amr-profile-test");
    expect(desktopShellSource).toContain("amr-profile-local");
    expect(desktopShellSource).toContain("OPEN_DESIGN_AMR_PROFILE");
    expect(desktopShellSource).toContain("/api/app-config");
    expect(desktopShellSource).toContain("agentModels");
    expect(desktopShellSource).toContain("od:app-config-changed");
    expect(desktopMenuSource).toContain("Code::KeyD");
  });
});
