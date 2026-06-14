import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');

async function readLandingFile(relativePath: string): Promise<string> {
  return readFile(join(root, relativePath), 'utf8');
}

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), 'utf8');
}

test('homepage exposes a real newsletter subscribe surface', async () => {
  const [homePage, indexPage, globals, templateExample, templateStyles] = await Promise.all([
    readLandingFile('app/page.tsx'),
    readLandingFile('app/pages/index.astro'),
    readLandingFile('app/globals.css'),
    readRepoFile('design-templates/open-design-landing/example.html'),
    readRepoFile('design-templates/open-design-landing/styles.css'),
  ]);

  for (const source of [homePage, templateExample]) {
    assert.match(source, /newsletter/);
    assert.match(source, /id=['"]newsletter['"]/);
    assert.match(source, /data-od-id=['"]newsletter['"]/);
    assert.match(source, /data-newsletter/);
    assert.match(source, /name=['"]email['"]/);
  }

  assert.doesNotMatch(indexPage, /HomeNewsletterEnhancer/);
  assert.match(indexPage, /form\[data-newsletter\]/);
  assert.match(indexPage, /fetch\(['"]\/subscribe['"]/);
  assert.match(indexPage, /source:\s*['"]landing['"]/);
  assert.match(indexPage, /newsletter-done/);
  assert.match(indexPage, /newsletter-error/);

  for (const styles of [globals, templateStyles, templateExample]) {
    assert.match(styles, /\.newsletter\s*\{/);
    assert.match(styles, /\.newsletter-form\s*\{/);
    assert.match(styles, /\.newsletter-input\s*\{/);
    assert.match(styles, /\.newsletter-submit\s*\{/);
  }
});
