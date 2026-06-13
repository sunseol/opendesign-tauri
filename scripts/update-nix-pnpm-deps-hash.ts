import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sharedHashPath = path.join(repoRoot, "nix/pnpm-deps.nix");

const consumerHashLine = "      hash = pnpmDepsHash;";
const fakeHashLine = "      hash = lib.fakeHash;";
const maxNixOutputBufferBytes = 32 * 1024 * 1024;

type Consumer = {
  readonly hashKey: "daemonHash" | "webHash";
  readonly label: "daemon" | "web";
  readonly consumerPath: string;
  readonly nixCommand: readonly string[];
};

type HashUpdateTarget = Consumer & {
  readonly sharedHashKey: string;
};

const splitHashConsumers = [
  {
    hashKey: "daemonHash",
    label: "daemon",
    consumerPath: path.join(repoRoot, "nix/package-daemon.nix"),
    nixCommand: ["build", ".#daemon", "--print-build-logs"],
  },
  {
    hashKey: "webHash",
    label: "web",
    consumerPath: path.join(repoRoot, "nix/package-web.nix"),
    nixCommand: ["build", ".#web", "--print-build-logs"],
  },
] as const satisfies readonly Consumer[];

export type PnpmDepsHashShape = "single" | "split";

export function extractExpectedHash(output: string): string | null {
  const matches = [...output.matchAll(/got:\s*(sha256-[A-Za-z0-9+/=]+)/g)];
  return matches.at(-1)?.[1] ?? null;
}

export function detectPnpmDepsHashShape(sharedHash: string): PnpmDepsHashShape {
  const hasSingleHash = /\bhash = "sha256-[A-Za-z0-9+/=]+";/.test(sharedHash);
  const hasDaemonHash = /\bdaemonHash = "sha256-[A-Za-z0-9+/=]+";/.test(sharedHash);
  const hasWebHash = /\bwebHash = "sha256-[A-Za-z0-9+/=]+";/.test(sharedHash);

  if (hasDaemonHash && hasWebHash) return "split";
  if (hasSingleHash) return "single";
  throw new Error(
    `Expected to find either \`hash = "sha256-...";\` or split \`daemonHash\` / \`webHash\` fields in ${path.relative(
      repoRoot,
      sharedHashPath,
    )}`,
  );
}

async function resolveHashTargets(): Promise<readonly HashUpdateTarget[]> {
  const sharedHash = await readFile(sharedHashPath, "utf8");
  const hashShape = detectPnpmDepsHashShape(sharedHash);

  if (hashShape === "split") {
    return splitHashConsumers.map((consumer) => ({
      ...consumer,
      sharedHashKey: consumer.hashKey,
    }));
  }

  const webConsumer = splitHashConsumers.find((consumer) => consumer.label === "web");
  if (!webConsumer) throw new Error("Internal error: missing web Nix hash consumer.");

  return [
    {
      ...webConsumer,
      sharedHashKey: "hash",
    },
  ];
}

async function main(): Promise<void> {
  const targets = await resolveHashTargets();
  const updates: string[] = [];

  for (const target of targets) {
    const originalConsumer = await readFile(target.consumerPath, "utf8");
    if (!originalConsumer.includes(consumerHashLine)) {
      throw new Error(
        `Expected to find \`${consumerHashLine.trim()}\` in ${path.relative(repoRoot, target.consumerPath)}`,
      );
    }

    const fakeHashConsumer = originalConsumer.replace(consumerHashLine, fakeHashLine);

    await writeFile(target.consumerPath, fakeHashConsumer, "utf8");

    try {
      const result = spawnSync("nix", target.nixCommand, {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: maxNixOutputBufferBytes,
        stdio: ["inherit", "pipe", "pipe"],
      });

      if (result.error) {
        throw new Error(`Failed to execute nix: ${result.error.message}`);
      }

      if (result.status === 0) {
        throw new Error(
          `nix ${target.nixCommand.join(
            " ",
          )} unexpectedly succeeded after replacing the fixed-output hash with lib.fakeHash.`,
        );
      }

      const combinedOutput = `${result.stdout}${result.stderr}`;
      const nextHash = extractExpectedHash(combinedOutput);
      if (!nextHash) {
        throw new Error(
          "nix build failed without reporting a fixed-output hash mismatch (`got: sha256-...`). " +
            `Refusing to update ${path.relative(repoRoot, sharedHashPath)}.\n\n${combinedOutput}`,
        );
      }

      const originalSharedHash = await readFile(sharedHashPath, "utf8");
      const hashPattern = new RegExp(`${target.sharedHashKey} = "sha256-[A-Za-z0-9+/=]+";`);
      if (!hashPattern.test(originalSharedHash)) {
        throw new Error(
          `Expected to find \`${target.sharedHashKey} = "sha256-...";\` in ${path.relative(
            repoRoot,
            sharedHashPath,
          )}`,
        );
      }

      const updatedSharedHash = originalSharedHash.replace(
        hashPattern,
        `${target.sharedHashKey} = "${nextHash}";`,
      );

      if (updatedSharedHash === originalSharedHash) {
        updates.push(`${target.sharedHashKey} already pins ${nextHash}`);
        continue;
      }

      await writeFile(sharedHashPath, updatedSharedHash, "utf8");
      updates.push(`${target.sharedHashKey} -> ${nextHash}`);
    } finally {
      await writeFile(target.consumerPath, originalConsumer, "utf8");
    }
  }

  process.stdout.write(
    `Updated ${path.relative(repoRoot, sharedHashPath)} (${updates.join(", ")}).\n` +
      `Re-run \`nix flake check --print-build-logs --keep-going\` to confirm.\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
