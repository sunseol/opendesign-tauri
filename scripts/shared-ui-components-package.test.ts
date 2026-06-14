import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

const componentSources = [
  "src/button.tsx",
  "src/button.module.css",
  "src/form-controls.tsx",
  "src/form-controls.module.css",
  "src/primitives.tsx",
  "src/styles.css",
  "src/visually-hidden.tsx",
] as const;

type PackageJson = {
  readonly dependencies?: Record<string, string>;
  readonly description?: string;
  readonly devDependencies?: Record<string, string>;
  readonly exports?: Record<string, unknown>;
  readonly name?: string;
  readonly peerDependencies?: Record<string, string>;
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

test("shared UI components package exposes reusable primitives", async () => {
  const packageDir = "packages/components";
  const manifest = await readPackageJson(path.join(packageDir, "package.json"));
  assert.equal(manifest.name, "@open-design/components");
  assert.equal(manifest.description, "Shared Open Design React UI primitives.");
  assert.equal(manifest.scripts?.build, "tsx ./esbuild.config.ts && tsc -p tsconfig.json --emitDeclarationOnly");
  assert.equal(manifest.scripts?.typecheck, "tsc -p tsconfig.json --noEmit");
  assert.equal(manifest.peerDependencies?.react, "18.3.1");
  assert.deepEqual(manifest.exports?.["./styles.css"], "./src/styles.css");

  for (const source of componentSources) {
    assert.equal(await exists(path.join(packageDir, source)), true, `${source} must exist`);
  }

  const indexSource = await readText(path.join(packageDir, "src/index.ts"));
  for (const exportName of ["Button", "Input", "Select", "Textarea", "VisuallyHidden"]) {
    assert.match(indexSource, new RegExp(`\\b${exportName}\\b`));
  }
});

test("web app consumes shared UI primitives instead of leaving them orphaned", async () => {
  const rootManifest = await readPackageJson("package.json");
  const webManifest = await readPackageJson("apps/web/package.json");

  assert.equal(rootManifest.devDependencies?.["@open-design/components"], "workspace:*");
  assert.equal(webManifest.dependencies?.["@open-design/components"], "workspace:*");

  const nextConfig = await readText("apps/web/next.config.ts");
  assert.match(nextConfig, /transpilePackages:\s*\[\s*['"]@open-design\/components['"]\s*\]/);

  const webSources = [
    "apps/web/src/components/AgentPicker.tsx",
    "apps/web/src/components/BoardComposerPopover.tsx",
    "apps/web/src/components/MissingBrandFontsBanner.tsx",
    "apps/web/src/components/PasteTextDialog.tsx",
    "apps/web/src/components/PromptTemplatesTab.tsx",
  ] as const;

  for (const source of webSources) {
    const sourceText = await readText(source);
    assert.match(sourceText, /from ['"]@open-design\/components['"]/);
  }
});
