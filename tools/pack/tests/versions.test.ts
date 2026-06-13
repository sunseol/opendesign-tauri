import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  readRuntimeAppVersion,
  versionCoreForAppVersion,
  versionFamilyForAppVersion,
} from "../src/versions.js";

describe("tools-pack version helpers", () => {
  it("reads the packaged app version unless an override is provided", async () => {
    const root = await mkdtemp(join(tmpdir(), "open-design-pack-version-"));
    try {
      const appRoot = join(root, "apps", "packaged");
      await mkdir(appRoot, { recursive: true });
      await writeFile(
        join(appRoot, "package.json"),
        `${JSON.stringify({ name: "open-design-packaged-app", version: "0.7.1" })}\n`,
        "utf8",
      );

      const config = { workspaceRoot: root } as Parameters<typeof readRuntimeAppVersion>[0];
      await expect(readRuntimeAppVersion(config)).resolves.toBe("0.7.1");
      await expect(readRuntimeAppVersion({ ...config, appVersion: "0.8.0-beta.1" })).resolves.toBe(
        "0.8.0-beta.1",
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("collapses prerelease build counters down to the X.Y.Z cache line", () => {
    expect(versionCoreForAppVersion("0.8.0")).toBe("0.8.0");
    expect(versionCoreForAppVersion("0.8.0-beta.6")).toBe("0.8.0");
    expect(versionCoreForAppVersion("0.8.0-preview.1")).toBe("0.8.0");
    expect(versionCoreForAppVersion("0.8.0.nightly.2")).toBe("0.8.0");
  });

  it("collapses app versions down to the X.Y cache family", () => {
    expect(versionFamilyForAppVersion("0.9.0")).toBe("0.9");
    expect(versionFamilyForAppVersion("0.9.1-beta.6")).toBe("0.9");
    expect(versionFamilyForAppVersion("0.9.1.preview.1")).toBe("0.9");
    expect(versionFamilyForAppVersion("1.10.2.nightly.3")).toBe("1.10");
    expect(versionFamilyForAppVersion("not-semver")).toBeNull();
  });
});
