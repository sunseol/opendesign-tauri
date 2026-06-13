import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wellKnownUserToolchainBins } from "../src/index.js";

describe("wellKnownUserToolchainBins Kimi Code locations", () => {
  it("includes the official ~/.kimi-code/bin install directory for GUI-launched daemons", () => {
    const home = mkdtempSync(join(tmpdir(), "wkutb-kimi-code-"));
    try {
      const dirs = wellKnownUserToolchainBins({
        home,
        env: {},
        includeSystemBins: false,
      });

      expect(dirs).toContain(join(home, ".kimi-code", "bin"));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
