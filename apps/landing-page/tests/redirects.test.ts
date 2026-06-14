import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REDIRECTS_PATH = join(TEST_DIR, '..', 'public', '_redirects');

function redirectsLines(): readonly string[] {
  return readFileSync(REDIRECTS_PATH, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function hasRedirect(
  lines: readonly string[],
  source: string,
  target: string,
  status: '301' | '302',
): boolean {
  return lines.includes(`${source} ${target} ${status}`);
}

test('legacy catalog redirects point to the plugin catalog', () => {
  const lines = redirectsLines();

  const expectedRedirects = [
    ['/skills/mode/*', '/plugins/skills/'],
    ['/skills/scenario/*', '/plugins/skills/'],
    ['/systems/category/*', '/plugins/systems/'],
    ['/systems/*', '/plugins/design-system-:splat'],
    ['/templates/*', '/plugins/example-:splat'],
    ['/skills/article-magazine/', '/plugins/example-article-magazine/'],
    ['/skills/*', '/plugins/skills/'],
    ['/skills/', '/plugins/skills/'],
    ['/systems/', '/plugins/systems/'],
    ['/templates/', '/plugins/templates/'],
  ] as const;

  for (const [source, target] of expectedRedirects) {
    assert.equal(hasRedirect(lines, source, target, '301'), true, `${source} should redirect to ${target}`);
  }
});

test('localized legacy catalog redirects preserve locale plugin sections', () => {
  const lines = redirectsLines();

  const expectedRedirects = [
    ['/zh/skills/*', '/zh/plugins/skills/'],
    ['/zh-tw/systems/*', '/zh-tw/plugins/systems/'],
    ['/ko/templates/*', '/ko/plugins/templates/'],
    ['/pt-br/skills/*', '/pt-br/plugins/skills/'],
  ] as const;

  for (const [source, target] of expectedRedirects) {
    assert.equal(hasRedirect(lines, source, target, '301'), true, `${source} should redirect to ${target}`);
  }
});
