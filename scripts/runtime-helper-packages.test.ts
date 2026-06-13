import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

const helperPackages = [
  { directory: "packages/download", name: "@open-design/download", dependencies: ["@open-design/platform"] },
  { directory: "packages/host", name: "@open-design/host", dependencies: [] },
  { directory: "packages/launcher-proto", name: "@open-design/launcher-proto", dependencies: ["@open-design/sidecar-proto"] },
  { directory: "packages/metatool", name: "@open-design/metatool", dependencies: [] },
  { directory: "packages/diagnostics", name: "@open-design/diagnostics", dependencies: [] },
  { directory: "packages/platform", name: "@open-design/platform", dependencies: [] },
  { directory: "packages/sidecar", name: "@open-design/sidecar", dependencies: [] },
  { directory: "packages/sidecar-proto", name: "@open-design/sidecar-proto", dependencies: [] },
] as const;

const packagedHelperBuildPackages = [
  "@open-design/host",
  "@open-design/sidecar-proto",
  "@open-design/sidecar",
  "@open-design/platform",
  "@open-design/diagnostics",
] as const;

const tauriOnlyPackagedSourceFiles = [
  "apps/packaged/src/index.ts",
  "apps/packaged/src/tauri-sidecars.ts",
] as const;

const electronLauncherSourceFiles = [
  "apps/packaged/src/launch.ts",
  "apps/packaged/src/launcher-after-quit.ts",
  "apps/packaged/src/launcher-runtime.ts",
  "apps/packaged/src/protocol.ts",
  "apps/packaged/src/windows-lifecycle.ts",
] as const;

type PackageJson = {
  readonly dependencies?: Record<string, string>;
  readonly files?: readonly string[];
  readonly name?: string;
  readonly scripts?: Record<string, string>;
};

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readPackageJson(relativePath: string): Promise<PackageJson> {
  return JSON.parse(await readText(relativePath));
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await stat(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

test("runtime helper packages remain buildable and package-scoped", async () => {
  for (const helper of helperPackages) {
    const manifest = await readPackageJson(path.join(helper.directory, "package.json"));
    assert.equal(manifest.name, helper.name);
    assert.equal(manifest.scripts?.build, "node ./esbuild.config.mjs && tsc -p tsconfig.json --emitDeclarationOnly");
    assert.ok(manifest.scripts?.test?.startsWith("vitest run"), `${helper.name} must keep a package test script`);
    assert.ok(manifest.scripts?.typecheck?.startsWith("tsc -p tsconfig.json --noEmit"), `${helper.name} must typecheck`);
    assert.deepEqual(manifest.files, ["dist"]);
    for (const dependency of helper.dependencies) {
      assert.equal(manifest.dependencies?.[dependency], "workspace:*");
    }
  }
});

test("Tauri packaged builds keep required runtime helpers in the build closure", async () => {
  const workspaceBuild = await readText("tools/pack/src/workspace-build.ts");
  const tauriBuild = await readText("tools/pack/src/tauri.ts");
  const macConstants = await readText("tools/pack/src/mac/constants.ts");
  const winConstants = await readText("tools/pack/src/win/constants.ts");

  for (const packageName of packagedHelperBuildPackages) {
    assert.match(workspaceBuild, new RegExp(`name: "${packageName.replaceAll("/", "\\/")}"`));
    assert.match(tauriBuild, new RegExp(`"--filter", "${packageName.replaceAll("/", "\\/")}", "build"`));
    assert.match(macConstants, new RegExp(`name: "${packageName.replaceAll("/", "\\/")}"`));
    assert.match(winConstants, new RegExp(`name: "${packageName.replaceAll("/", "\\/")}"`));
  }
});

test("packaged runtime keeps Tauri sidecar entrypoints instead of Electron launchers", async () => {
  const packagedManifest = await readPackageJson("apps/packaged/package.json");
  const toolsPackManifest = await readPackageJson("tools/pack/package.json");
  const packagedIndex = await readText("apps/packaged/src/index.ts");

  assert.equal(packagedIndex.trim(), 'import "./tauri-sidecars.js";');
  for (const sourceFile of tauriOnlyPackagedSourceFiles) {
    assert.equal(await exists(sourceFile), true, `${sourceFile} must exist`);
  }
  for (const sourceFile of electronLauncherSourceFiles) {
    assert.equal(await exists(sourceFile), false, `${sourceFile} must stay absent from the Tauri fork`);
  }
  for (const packageName of ["@open-design/platform", "@open-design/sidecar", "@open-design/sidecar-proto"] as const) {
    assert.equal(packagedManifest.dependencies?.[packageName], "workspace:*");
    assert.equal(toolsPackManifest.dependencies?.[packageName], "workspace:*");
  }
});
