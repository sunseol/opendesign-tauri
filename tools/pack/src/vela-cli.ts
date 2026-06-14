import { access, chmod, constants, cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export const VELA_CLI_BIN_ENV = "OPEN_DESIGN_VELA_CLI_BIN";

const OPEN_CODE_COMPANION_RELATIVE_PATH = ["libexec", "opencode"] as const;

export type VelaCliPlatform = "linux" | "mac" | "win";

type VelaCliResolveResult =
  | string
  | null
  | undefined
  | {
      readonly path?: string | null;
      readonly supported?: boolean;
    };

type VelaCliResolverModule = {
  readonly resolveVelaCliBin?: (
    options?: { readonly strict?: boolean },
  ) => VelaCliResolveResult | Promise<VelaCliResolveResult>;
};

type VelaCliImportPackage = (packageName: string) => Promise<VelaCliResolverModule>;

function moduleResolver(value: unknown): VelaCliResolverModule {
  if (value == null || typeof value !== "object") return {};
  if (!("resolveVelaCliBin" in value)) return {};
  const resolveVelaCliBin = value.resolveVelaCliBin;
  if (typeof resolveVelaCliBin !== "function") return {};
  return {
    resolveVelaCliBin: resolveVelaCliBin as VelaCliResolverModule["resolveVelaCliBin"],
  };
}

async function importVelaCliResolver(packageName: string): Promise<VelaCliResolverModule> {
  return moduleResolver(await import(packageName));
}

function strictResolutionError(message: string, cause?: unknown): Error {
  return new Error(
    `${message}; install @powerformer/vela-cli through pnpm install or set ${VELA_CLI_BIN_ENV}`,
    cause === undefined ? undefined : { cause },
  );
}

function targetBinaryName(platform: VelaCliPlatform): string {
  return platform === "win" ? "vela.exe" : "vela";
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function isExecutableFile(filePath: string, platform: VelaCliPlatform): Promise<boolean> {
  try {
    if (!(await stat(filePath)).isFile()) return false;
    if (platform === "win") return filePath.toLowerCase().endsWith(".exe");
    await access(filePath, constants.X_OK);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function openCodeCompanionBinaryName(platform: VelaCliPlatform): string {
  return platform === "win" ? "opencode.exe" : "opencode";
}

export function resolveVelaCliOpenCodeCompanionTree(source: string): string {
  return join(dirname(source), ...OPEN_CODE_COMPANION_RELATIVE_PATH);
}

async function copyBundledOpenCodeTree({
  platform,
  requireBundled,
  resourceRoot,
  source,
}: {
  readonly platform: VelaCliPlatform;
  readonly requireBundled: boolean;
  readonly resourceRoot: string;
  readonly source: string;
}): Promise<void> {
  const sourceTree = resolveVelaCliOpenCodeCompanionTree(source);
  const targetTree = join(resourceRoot, "bin", ...OPEN_CODE_COMPANION_RELATIVE_PATH);
  if (!(await isDirectory(sourceTree))) {
    if (requireBundled) {
      throw strictResolutionError(
        `unable to resolve bundled Vela CLI: OpenCode companion directory is missing at ${sourceTree}`,
      );
    }
    return;
  }
  const sourceExecutable = join(sourceTree, openCodeCompanionBinaryName(platform));
  if (!(await isExecutableFile(sourceExecutable, platform))) {
    if (requireBundled) {
      throw strictResolutionError(
        `unable to resolve bundled Vela CLI: OpenCode companion executable is missing at ${sourceExecutable}`,
      );
    }
    return;
  }
  await cp(sourceTree, targetTree, { force: true, recursive: true });
}

export async function copyOptionalVelaCliBinary({
  env = process.env,
  importPackage,
  platform,
  requireBundled = false,
  resourceRoot,
}: {
  readonly env?: NodeJS.ProcessEnv;
  readonly importPackage?: VelaCliImportPackage;
  readonly platform: VelaCliPlatform;
  readonly requireBundled?: boolean;
  readonly resourceRoot: string;
}): Promise<{ readonly source: string; readonly target: string } | null> {
  const source = await resolveOptionalVelaCliBinary({ env, importPackage, requireBundled });
  if (source == null) return null;
  const target = join(resourceRoot, "bin", targetBinaryName(platform));
  await mkdir(dirname(target), { recursive: true });
  await copyBundledOpenCodeTree({ platform, requireBundled, resourceRoot, source });
  await cp(source, target);
  if (platform !== "win") {
    await chmod(target, 0o755);
  }
  return { source, target };
}

export async function resolveOptionalVelaCliBinary({
  env = process.env,
  importPackage = importVelaCliResolver,
  requireBundled = false,
}: {
  readonly env?: NodeJS.ProcessEnv;
  readonly importPackage?: VelaCliImportPackage;
  readonly requireBundled?: boolean;
} = {}): Promise<string | null> {
  const envSource = env[VELA_CLI_BIN_ENV]?.trim();
  if (envSource) return envSource;

  let resolver: VelaCliResolverModule;
  try {
    resolver = await importPackage("@powerformer/vela-cli");
  } catch (error) {
    if (requireBundled) {
      throw strictResolutionError(
        "unable to resolve bundled Vela CLI: package @powerformer/vela-cli is unavailable",
        error,
      );
    }
    return null;
  }

  if (typeof resolver.resolveVelaCliBin !== "function") {
    if (requireBundled) {
      throw strictResolutionError(
        "unable to resolve bundled Vela CLI: @powerformer/vela-cli must export resolveVelaCliBin",
      );
    }
    return null;
  }

  const resolved = await resolver.resolveVelaCliBin({ strict: requireBundled });
  if (typeof resolved === "string") {
    const normalized = resolved.trim();
    if (normalized.length > 0) return normalized;
  }
  if (resolved && typeof resolved === "object" && typeof resolved.path === "string") {
    const normalized = resolved.path.trim();
    if (normalized.length > 0) return normalized;
  }
  if (requireBundled) {
    throw strictResolutionError(
      "unable to resolve bundled Vela CLI: @powerformer/vela-cli returned no binary path",
    );
  }
  return null;
}
