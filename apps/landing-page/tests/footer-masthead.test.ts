import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '..', '..');

async function readLandingFile(relativePath: string): Promise<string> {
  return readFile(join(root, relativePath), 'utf8');
}

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), 'utf8');
}

test('footer masthead appears in both landing footers and the canonical template', async () => {
  const [siteFooter, homePage, globals, templateExample, templateStyles, templateComposer] = await Promise.all([
    readLandingFile('app/_components/site-footer.astro'),
    readLandingFile('app/page.tsx'),
    readLandingFile('app/globals.css'),
    readRepoFile('design-templates/open-design-landing/example.html'),
    readRepoFile('design-templates/open-design-landing/styles.css'),
    readRepoFile('design-templates/open-design-landing/scripts/compose.ts'),
  ]);

  for (const source of [siteFooter, homePage, templateExample, templateComposer]) {
    assert.match(source, /foot-masthead/);
    assert.match(source, /data-od-id=['"]footer-masthead['"]/);
    assert.match(source, /Open\s*<span[^>]+foot-masthead-accent[^>]+>Design<\/span>/);
  }

  for (const styles of [globals, templateStyles]) {
    assert.match(styles, /\.foot-masthead\s*\{/);
    assert.match(styles, /\.foot-masthead-wordmark\s*\{/);
    assert.match(styles, /font-size:\s*clamp\(26px,\s*10\.4vw,\s*158px\);/);
    assert.match(styles, /white-space:\s*nowrap;/);
    assert.match(
      styles,
      /@media \(max-width:\s*720px\)[\s\S]*\.foot-masthead-wordmark\s*\{\s*white-space:\s*normal;\s*\}/,
    );
  }
});
