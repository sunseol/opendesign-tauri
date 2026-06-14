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
  const [homePage, indexPage, newsletterSection, newsletterEnhancer, globals, newsletterCopy, templateExample, templateStyles] = await Promise.all([
    readLandingFile('app/page.tsx'),
    readLandingFile('app/pages/index.astro'),
    readLandingFile('app/_components/home-newsletter-section.tsx'),
    readLandingFile('app/_components/home-newsletter-enhancer.astro'),
    readLandingFile('app/globals.css'),
    readLandingFile('app/home-newsletter-copy.ts'),
    readRepoFile('design-templates/open-design-landing/example.html'),
    readRepoFile('design-templates/open-design-landing/styles.css'),
  ]);

  assert.match(homePage, /HomeNewsletterSection/);

  for (const source of [newsletterSection, templateExample]) {
    assert.match(source, /newsletter/);
    assert.match(source, /id=['"]newsletter['"]/);
    assert.match(source, /data-od-id=['"]newsletter['"]/);
    assert.match(source, /data-newsletter/);
    assert.match(source, /name=['"]email['"]/);
  }

  assert.match(indexPage, /HomeNewsletterEnhancer/);
  assert.match(newsletterEnhancer, /form\[data-newsletter\]/);
  assert.match(newsletterEnhancer, /fetch\(['"]\/subscribe['"]/);
  assert.match(newsletterEnhancer, /source:\s*['"]landing['"]/);
  assert.match(newsletterEnhancer, /newsletter-done/);
  assert.match(newsletterEnhancer, /newsletter-error/);

  for (const styles of [globals, templateStyles, templateExample]) {
    assert.match(styles, /\.newsletter\s*\{/);
    assert.match(styles, /\.newsletter-form\s*\{/);
    assert.match(styles, /\.newsletter-input\s*\{/);
    assert.match(styles, /\.newsletter-submit\s*\{/);
  }

  assert.match(newsletterCopy, /satisfies\s+Record<LandingLocaleCode,\s*HomeNewsletterCopy>/);
  assert.match(newsletterCopy, /done:/);
  assert.match(newsletterCopy, /error:/);
});
