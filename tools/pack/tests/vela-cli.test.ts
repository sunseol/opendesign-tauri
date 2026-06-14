import { access, chmod, constants, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { copyOptionalVelaCliBinary, resolveOptionalVelaCliBinary } from "../src/vela-cli.js";

async function writeFakeOpenCodeCompanion(
  source: string,
  content = "#!/bin/sh\nexit 0\n",
  binaryName = "opencode",
): Promise<string> {
  const companion = join(dirname(source), "libexec", "opencode", binaryName);
  await mkdir(dirname(companion), { recursive: true });
  await writeFile(companion, content, "utf8");
  await chmod(companion, 0o755);
  return companion;
}

describe("copyOptionalVelaCliBinary", () => {
  it("copies a configured Vela CLI binary and OpenCode companion into resource bin", async () => {
    const root = await mkdtemp(join(tmpdir(), "open-design-tools-pack-vela-"));
    const source = join(root, "source", "vela");
    const resourceRoot = join(root, "resources", "open-design");

    try {
      await mkdir(join(root, "source"), { recursive: true });
      await writeFile(source, "#!/bin/sh\nexit 0\n", "utf8");
      await writeFakeOpenCodeCompanion(source, "#!/bin/sh\necho opencode\n");

      const copied = await copyOptionalVelaCliBinary({
        env: { OPEN_DESIGN_VELA_CLI_BIN: source },
        platform: "mac",
        requireBundled: true,
        resourceRoot,
      });

      const target = join(resourceRoot, "bin", "vela");
      const companionTarget = join(resourceRoot, "bin", "libexec", "opencode", "opencode");
      await expect(readFile(target, "utf8")).resolves.toBe("#!/bin/sh\nexit 0\n");
      await expect(readFile(companionTarget, "utf8")).resolves.toBe("#!/bin/sh\necho opencode\n");
      await expect(access(target, constants.X_OK)).resolves.toBeUndefined();
      await expect(access(companionTarget, constants.X_OK)).resolves.toBeUndefined();
      expect(copied).toEqual({ source, target });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("fails strict mode when the OpenCode companion tree is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "open-design-tools-pack-vela-strict-"));
    const source = join(root, "source", "vela");
    const resourceRoot = join(root, "resources", "open-design");

    try {
      await mkdir(join(root, "source"), { recursive: true });
      await writeFile(source, "#!/bin/sh\nexit 0\n", "utf8");

      await expect(
        copyOptionalVelaCliBinary({
          env: { OPEN_DESIGN_VELA_CLI_BIN: source },
          platform: "mac",
          requireBundled: true,
          resourceRoot,
        }),
      ).rejects.toThrow(/OpenCode companion directory is missing.*OPEN_DESIGN_VELA_CLI_BIN/);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("fails strict mode when the OpenCode companion executable is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "open-design-tools-pack-vela-no-exe-"));
    const source = join(root, "source", "vela");
    const resourceRoot = join(root, "resources", "open-design");

    try {
      await mkdir(join(root, "source", "libexec", "opencode"), { recursive: true });
      await writeFile(source, "#!/bin/sh\nexit 0\n", "utf8");

      await expect(
        copyOptionalVelaCliBinary({
          env: { OPEN_DESIGN_VELA_CLI_BIN: source },
          platform: "mac",
          requireBundled: true,
          resourceRoot,
        }),
      ).rejects.toThrow(/OpenCode companion executable is missing.*OPEN_DESIGN_VELA_CLI_BIN/);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("copies a Windows Vela CLI binary to vela.exe", async () => {
    const root = await mkdtemp(join(tmpdir(), "open-design-tools-pack-vela-win-"));
    const source = join(root, "source", "vela.exe");
    const resourceRoot = join(root, "resources", "open-design");

    try {
      await mkdir(join(root, "source"), { recursive: true });
      await writeFile(source, "fake exe\n", "utf8");
      await writeFakeOpenCodeCompanion(source, "fake opencode\n", "opencode.exe");

      const copied = await copyOptionalVelaCliBinary({
        env: { OPEN_DESIGN_VELA_CLI_BIN: source },
        platform: "win",
        resourceRoot,
      });

      const target = join(resourceRoot, "bin", "vela.exe");
      const companionTarget = join(resourceRoot, "bin", "libexec", "opencode", "opencode.exe");
      await expect(readFile(target, "utf8")).resolves.toBe("fake exe\n");
      await expect(readFile(companionTarget, "utf8")).resolves.toBe("fake opencode\n");
      expect(copied).toEqual({ source, target });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

describe("resolveOptionalVelaCliBinary", () => {
  it("prefers OPEN_DESIGN_VELA_CLI_BIN over the npm resolver", async () => {
    await expect(
      resolveOptionalVelaCliBinary({
        env: { OPEN_DESIGN_VELA_CLI_BIN: "/tmp/local-vela" },
        importPackage: async () => ({
          resolveVelaCliBin: () => "/tmp/npm-vela",
        }),
      }),
    ).resolves.toBe("/tmp/local-vela");
  });

  it("returns null in non-strict mode when the resolver package is missing", async () => {
    await expect(
      resolveOptionalVelaCliBinary({
        env: {},
        importPackage: async () => {
          throw new Error("not installed");
        },
      }),
    ).resolves.toBeNull();
  });

  it("fails strict mode when the resolver package is missing", async () => {
    await expect(
      resolveOptionalVelaCliBinary({
        env: {},
        importPackage: async () => {
          throw new Error("not installed");
        },
        requireBundled: true,
      }),
    ).rejects.toThrow(/@powerformer\/vela-cli.*OPEN_DESIGN_VELA_CLI_BIN/);
  });
});
