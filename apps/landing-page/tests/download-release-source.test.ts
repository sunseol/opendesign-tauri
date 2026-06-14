import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getLatestRelease } from '../app/_lib/github';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readLandingFile(relativePath: string): Promise<string> {
  return readFile(join(root, relativePath), 'utf8');
}

const releaseSourceRoots = ['app', 'functions', 'public/community'] as const;
const releaseSourceExtensions = new Set(['.astro', '.html', '.js', '.ts', '.tsx']);

async function collectReleaseSourceFiles(relativeDirectory: string): Promise<string[]> {
  const entries = await readdir(join(root, relativeDirectory), { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectReleaseSourceFiles(relativePath)));
      continue;
    }

    if (entry.isFile() && releaseSourceExtensions.has(extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

test('download release lookup targets the Tauri fork and falls back without upstream assets', async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    requestedUrls.push(url);
    return new Response(JSON.stringify({ message: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  globalThis.fetch = mockFetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const release = await getLatestRelease();

  assert.deepEqual(requestedUrls, ['https://api.github.com/repos/sunseol/opendesign-tauri/releases/latest']);
  assert.equal(release.releaseUrl, 'https://github.com/sunseol/opendesign-tauri/releases');
  assert.equal(release.version, '0.0.0-tauri');
  assert.equal(release.versionLabel, 'Tauri builds pending');
  assert.equal(release.resolved, false);
  assert.equal(Object.values(release.matrix).filter((asset) => asset !== null).length, 0);
});

test('download enhancers avoid upstream Electron release endpoints', async () => {
  const files = [
    'app/_lib/release-metadata.ts',
    'app/_lib/github.ts',
    'app/_components/header-enhancer.astro',
    'app/_components/home-enhancer.astro',
    'app/_components/alternative-detail.astro',
    'app/_components/site-footer.astro',
    'app/page.tsx',
    'app/pages/index.astro',
    'app/pages/download/index.astro',
    'app/pages/plugins/[slug]/index.astro',
    'app/pages/skills/[slug]/index.astro',
    'app/pages/templates/[slug]/index.astro',
    'app/pages/blog/[slug].astro',
    'functions/release-metadata.ts',
    'public/community/_site-nav.js',
  ] as const;

  for (const file of files) {
    const source = await readLandingFile(file);
    assert.doesNotMatch(source, /api\.github\.com\/repos\/nexu-io\/open-design\/releases\/latest/);
    assert.doesNotMatch(source, /github\.com\/nexu-io\/open-design\/releases/);
    assert.match(source, /sunseol\/opendesign-tauri|RELEASE_GITHUB_(?:LATEST|RELEASES)_URL|fallbackReleaseMetadata/);
  }
});

test('ported landing sources do not expose upstream Electron release roots', async () => {
  const filesByRoot = await Promise.all(releaseSourceRoots.map((sourceRoot) => collectReleaseSourceFiles(sourceRoot)));
  const files = filesByRoot.flat();
  const offenders: string[] = [];

  for (const file of files) {
    const source = await readLandingFile(file);
    if (
      /api\.github\.com\/repos\/nexu-io\/open-design\/releases\/latest/.test(source) ||
      /github\.com\/nexu-io\/open-design\/releases(?!\/tag\/)/.test(source) ||
      /`\$\{REPO\}\/releases`/.test(source)
    ) {
      offenders.push(file);
    }
  }

  assert.deepEqual(offenders, []);
});
