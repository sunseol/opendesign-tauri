import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ToolPackConfig } from "./config.js";
import { PRODUCT_NAME } from "./mac/constants.js";
import { copyBundledResourceTrees } from "./resources.js";
import { copyOptionalVelaCliBinary } from "./vela-cli.js";

export type TauriBundleTarget = "app" | "appimage" | "dmg" | "nsis";

export type TauriResourcePaths = {
  readonly assembledAppRoot: string;
  readonly mergeConfigPath: string;
  readonly packagedConfigPath: string;
  readonly resourceRoot: string;
};

const TAURI_LINUX_MAIN_BINARY_NAME = "open-design-desktop-tauri";

export function resolveTauriResourcePaths(config: ToolPackConfig): TauriResourcePaths {
  const namespaceRoot = config.roots.output.namespaceRoot;
  return {
    assembledAppRoot: join(namespaceRoot, "assembled", "app"),
    mergeConfigPath: join(namespaceRoot, "tauri-pack.conf.json"),
    packagedConfigPath: join(namespaceRoot, "open-design-config.json"),
    resourceRoot: join(namespaceRoot, "resources", "open-design"),
  };
}

function nodeResourceName(config: ToolPackConfig): string {
  return config.platform === "win" ? "node.exe" : "node";
}

export async function copyTauriResourceTree(
  config: ToolPackConfig,
  paths: TauriResourcePaths,
): Promise<void> {
  await rm(paths.resourceRoot, { force: true, recursive: true });
  await mkdir(paths.resourceRoot, { recursive: true });
  await copyBundledResourceTrees({
    workspaceRoot: config.workspaceRoot,
    resourceRoot: paths.resourceRoot,
  });
  await mkdir(join(paths.resourceRoot, "bin"), { recursive: true });
  const nodePath = join(paths.resourceRoot, "bin", nodeResourceName(config));
  await cp(process.execPath, nodePath);
  await copyOptionalVelaCliBinary({
    platform: config.platform,
    requireBundled: config.requireVelaCli,
    resourceRoot: paths.resourceRoot,
  });
  if (config.platform !== "win") {
    await chmod(nodePath, 0o755);
  }
}

export function resolveTauriBundleTargets(config: ToolPackConfig): TauriBundleTarget[] {
  switch (config.platform) {
    case "mac":
      switch (config.to) {
        case "all":
          return ["app", "dmg"];
        case "app":
        case "zip":
          return ["app"];
        case "dmg":
          return ["dmg"];
        default:
          throw new Error(`unsupported mac Tauri --to target: ${config.to}`);
      }
    case "win":
      switch (config.to) {
        case "all":
        case "nsis":
          return ["nsis"];
        case "dir":
          throw new Error(
            "tools-pack win build --desktop-runtime tauri --to dir is not supported by Tauri; use --to nsis",
          );
        default:
          throw new Error(`unsupported win Tauri --to target: ${config.to}`);
      }
    case "linux":
      switch (config.to) {
        case "all":
        case "appimage":
          return ["appimage"];
        case "dir":
          throw new Error(
            "tools-pack linux build --desktop-runtime tauri --to dir is not supported by Tauri; use --to appimage",
          );
        default:
          throw new Error(`unsupported linux Tauri --to target: ${config.to}`);
      }
  }
}

export function tauriTargetRoot(config: ToolPackConfig): string {
  return join(config.workspaceRoot, "apps", "desktop", "src-tauri", "target", "release", "bundle");
}

export function resolveTauriMainBinaryName(config: Pick<ToolPackConfig, "platform">): string {
  return config.platform === "linux" ? TAURI_LINUX_MAIN_BINARY_NAME : PRODUCT_NAME;
}

export async function writeTauriMergeConfig(
  config: ToolPackConfig,
  paths: TauriResourcePaths,
  targets: TauriBundleTarget[],
): Promise<void> {
  await mkdir(dirname(paths.mergeConfigPath), { recursive: true });
  await writeFile(
    paths.mergeConfigPath,
    `${JSON.stringify(
      {
        mainBinaryName: resolveTauriMainBinaryName(config),
        bundle: {
          targets,
          resources: {
            [paths.assembledAppRoot]: "app",
            [paths.resourceRoot]: "open-design",
            [paths.packagedConfigPath]: "open-design-config.json",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
