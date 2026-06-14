import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function readPackageJson(path: string): Record<string, unknown> {
  const manifest = readJson(path);
  assert(typeof manifest === "object" && manifest !== null);
  return manifest as Record<string, unknown>;
}

function packageName(manifest: unknown): string {
  assert(typeof manifest === "object" && manifest !== null);
  const name = (manifest as { name?: unknown }).name;
  assert(typeof name === "string");
  return name;
}

function packageBinTargets(manifest: unknown): string[] {
  assert(typeof manifest === "object" && manifest !== null);
  const bin = (manifest as { bin?: unknown }).bin;
  if (typeof bin === "string") return [bin];
  if (typeof bin !== "object" || bin === null) return [];
  return Object.values(bin).filter((value): value is string => typeof value === "string");
}

function dependencySpecifier(manifest: Record<string, unknown>, name: string): string | undefined {
  const dependencyFields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const;
  for (const field of dependencyFields) {
    const dependencies = manifest[field];
    if (typeof dependencies !== "object" || dependencies === null) continue;
    const specifier = (dependencies as Record<string, unknown>)[name];
    if (typeof specifier === "string") return specifier;
  }
  return undefined;
}

function distDelegatingBinTargets(directory: string, manifest: unknown): string[] {
  return packageBinTargets(manifest).filter((binTarget) => {
    if (binTarget.startsWith("./dist/")) return true;
    const source = readFileSync(join(repoRoot, directory, binTarget), "utf8");
    return source.includes("../dist/") || source.includes("./dist/") || source.includes("/dist/");
  });
}

function workspaceDependencyNames(manifest: unknown, includeDevDependencies = false): Set<string> {
  assert(typeof manifest === "object" && manifest !== null);
  const dependencyFields = includeDevDependencies
    ? ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
    : ["dependencies", "optionalDependencies", "peerDependencies"];
  const names = new Set<string>();

  for (const field of dependencyFields) {
    const dependencies = (manifest as Record<string, unknown>)[field];
    if (typeof dependencies !== "object" || dependencies === null) continue;
    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        names.add(name);
      }
    }
  }

  return names;
}

function postinstallBuildTargets(): Set<string> {
  const manifest = readJson("scripts/postinstall-build-targets.json");
  assert(typeof manifest === "object" && manifest !== null);
  const buildTargets = (manifest as { buildTargets?: unknown }).buildTargets;
  assert(Array.isArray(buildTargets));
  assert(buildTargets.every((target): target is string => typeof target === "string"));
  return new Set(buildTargets);
}

test("postinstall build target list ignores non-directory paths quoted by postinstall", () => {
  assert.equal(postinstallBuildTargets().has("apps/daemon/package.json"), false);
});

function workspacePackageDirectories(): string[] {
  const scopedPackageDirectories = ["apps", "packages", "tools"].flatMap((scope) =>
    readdirSync(join(repoRoot, scope), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${scope}/${entry.name}`),
  );
  return ["e2e", ...scopedPackageDirectories]
    .filter((directory) => existsSync(join(repoRoot, directory, "package.json")))
    .sort();
}

test("workspace bin entries use checked-in targets so pnpm can link them before postinstall", () => {
  const manifests = new Map(
    workspacePackageDirectories().map((directory) => [
      directory,
      readJson(`${directory}/package.json`),
    ]),
  );
  const consumedWorkspacePackages = new Set<string>();
  for (const manifest of manifests.values()) {
    for (const name of workspaceDependencyNames(manifest)) {
      consumedWorkspacePackages.add(name);
    }
  }

  const unlinkableBins = [...manifests.entries()]
    .filter(([, manifest]) => consumedWorkspacePackages.has(packageName(manifest)))
    .flatMap(([directory, manifest]) =>
      packageBinTargets(manifest).map((binTarget) => ({
        binTarget,
        directory,
        resolvedPath: join(repoRoot, directory, binTarget),
      })),
    )
    .filter(({ resolvedPath }) => !existsSync(resolvedPath))
    .map(({ binTarget, directory }) => `${directory}:${binTarget}`);

  assert.deepEqual(unlinkableBins, []);
});

test("root workspace depends on the daemon package so pnpm exec resolves the od bin", () => {
  const rootManifest = readPackageJson("package.json");
  const daemonManifest = readPackageJson("apps/daemon/package.json");

  assert.equal(dependencySpecifier(rootManifest, "@open-design/daemon"), "workspace:*");
  assert.deepEqual((rootManifest as { bin?: unknown }).bin, {
    od: "./apps/daemon/bin/od.mjs",
  });
  assert.deepEqual((daemonManifest as { bin?: unknown }).bin, {
    od: "./bin/od.mjs",
  });
  assert.equal(existsSync(join(repoRoot, "apps/daemon/bin/od.mjs")), true);
});

test("postinstall builds workspace packages whose linkable bins delegate to dist", () => {
  const rootManifest = readPackageJson("package.json");
  const manifests = new Map(
    workspacePackageDirectories().map((directory) => [
      directory,
      readJson(`${directory}/package.json`),
    ]),
  );
  const consumedWorkspacePackages = new Set<string>();
  for (const name of workspaceDependencyNames(rootManifest, true)) {
    consumedWorkspacePackages.add(name);
  }
  for (const manifest of manifests.values()) {
    for (const name of workspaceDependencyNames(manifest)) {
      consumedWorkspacePackages.add(name);
    }
  }

  const missingBuildTargets = [...manifests.entries()]
    .filter(([, manifest]) => consumedWorkspacePackages.has(packageName(manifest)))
    .filter(([directory, manifest]) => distDelegatingBinTargets(directory, manifest).length > 0)
    .map(([directory]) => directory)
    .filter((directory) => !postinstallBuildTargets().has(directory));

  assert.deepEqual(missingBuildTargets, []);
});

test("postinstall builds the shared components package before workspace consumers import dist", () => {
  assert.equal(postinstallBuildTargets().has("packages/components"), true);
});

test("every postinstall build target has a checked-in tsconfig.json", () => {
  const missingTsconfigs = [...postinstallBuildTargets()]
    .filter((target) => existsSync(join(repoRoot, target, "package.json")))
    .filter((target) => !existsSync(join(repoRoot, target, "tsconfig.json")));

  assert.deepEqual(missingTsconfigs, []);
});

test("postinstall skips build targets whose tsconfig.json is absent from the install context", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "postinstall-test-"));
  try {
    mkdirSync(join(sandbox, "scripts"));
    writeFileSync(
      join(sandbox, "scripts", "postinstall.mjs"),
      readFileSync(join(repoRoot, "scripts/postinstall.mjs")),
    );
    writeFileSync(
      join(sandbox, "scripts", "postinstall-build-targets.json"),
      readFileSync(join(repoRoot, "scripts/postinstall-build-targets.json")),
    );

    mkdirSync(join(sandbox, "packages/contracts"), { recursive: true });
    writeFileSync(join(sandbox, "packages/contracts/package.json"), "{}");
    writeFileSync(join(sandbox, "packages/contracts/tsconfig.json"), "{}");

    mkdirSync(join(sandbox, "apps/daemon"), { recursive: true });
    writeFileSync(join(sandbox, "apps/daemon/package.json"), "{}");

    const invocationLog = join(sandbox, "invocations.log");
    writeFileSync(
      join(sandbox, "pnpm-stub.mjs"),
      [
        'import { appendFileSync } from "node:fs";',
        `appendFileSync(${JSON.stringify(invocationLog)}, process.argv.slice(2).join(" ") + "\\n");`,
      ].join("\n"),
    );

    const result = spawnSync(process.execPath, [join(sandbox, "scripts", "postinstall.mjs")], {
      encoding: "utf8",
      env: { ...process.env, npm_execpath: join(sandbox, "pnpm-stub.mjs") },
    });

    assert.equal(result.status, 0, result.stderr);
    const invocations = existsSync(invocationLog) ? readFileSync(invocationLog, "utf8") : "";
    assert.match(invocations, /-C packages\/contracts run build/);
    assert.doesNotMatch(invocations, /-C apps\/daemon run build/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
