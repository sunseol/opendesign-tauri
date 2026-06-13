import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const communityRoot = path.join(repoRoot, 'plugins', 'community');
const registryPath = path.join(
  repoRoot,
  'plugins',
  'registry',
  'community',
  'open-design-marketplace.json',
);

const expectedSlidePackEntries = [
  'community/frontend-slides',
  'community/huashu-slides',
  'community/fs-creative-voltage',
  'community/hps-bauhaus',
  'community/ve-terminal-mono',
];

interface CommunityMarketplaceEntry {
  name?: string;
}

function communityMarketplaceEntries(): CommunityMarketplaceEntry[] {
  const manifest = JSON.parse(readFileSync(registryPath, 'utf8')) as {
    plugins?: CommunityMarketplaceEntry[];
  };
  return manifest.plugins ?? [];
}

describe('community plugin registry content', () => {
  it('publishes the upstream slide and deck community plugin pack', () => {
    const names = communityMarketplaceEntries().map((entry) => entry.name);

    expect(names).toEqual(expect.arrayContaining(expectedSlidePackEntries));
  });

  it('points every community marketplace entry at a runnable plugin folder', () => {
    for (const entry of communityMarketplaceEntries()) {
      expect(typeof entry.name).toBe('string');
      const pluginName = entry.name as string;
      const folderName = pluginName.replace(/^community\//, '');
      const folder = path.join(communityRoot, folderName);

      expect(
        existsSync(path.join(folder, 'open-design.json')),
        `${pluginName} is missing open-design.json`,
      ).toBe(true);
      expect(
        existsSync(path.join(folder, 'SKILL.md')),
        `${pluginName} is missing SKILL.md`,
      ).toBe(true);
    }
  });
});
