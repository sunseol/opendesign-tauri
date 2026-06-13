import assert from "node:assert/strict";
import test from "node:test";

import {
  detectPnpmDepsHashShape,
  extractExpectedHash,
} from "./update-nix-pnpm-deps-hash.ts";

test("extractExpectedHash returns the last fixed-output hash from nix output", () => {
  assert.equal(
    extractExpectedHash(
      [
        "error: hash mismatch in fixed-output derivation",
        "got:    sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=",
        "wanted: sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb=",
        "got: sha256-ccccccccccccccccccccccccccccccccccccccc=",
      ].join("\n"),
    ),
    "sha256-ccccccccccccccccccccccccccccccccccccccc=",
  );
});

test("extractExpectedHash returns null when nix output has no got hash", () => {
  assert.equal(extractExpectedHash("builder failed before fixed-output hash check"), null);
});

test("detectPnpmDepsHashShape supports the current shared hash file", () => {
  assert.equal(detectPnpmDepsHashShape('hash = "sha256-currentHash=";'), "single");
});

test("detectPnpmDepsHashShape supports upstream split hash files", () => {
  assert.equal(
    detectPnpmDepsHashShape(
      [
        'daemonHash = "sha256-daemonHash=";',
        'webHash = "sha256-webHash=";',
      ].join("\n"),
    ),
    "split",
  );
});

test("detectPnpmDepsHashShape rejects malformed generated hash files", () => {
  assert.throws(
    () => detectPnpmDepsHashShape('hash = "not-a-nix-sha";'),
    /Expected to find either/,
  );
});
