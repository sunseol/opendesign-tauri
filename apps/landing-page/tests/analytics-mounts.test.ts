import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { injectPostHog, posthogHeadHtml } from '../app/_lib/posthog-analytics';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readLandingFile(relativePath: string): Promise<string> {
  return readFile(join(root, relativePath), 'utf8');
}

test('PostHog head html is gated by the landing build env', () => {
  assert.equal(posthogHeadHtml(undefined, undefined), '');

  const html = posthogHeadHtml(' phc_test ', ' https://posthog.example// ');
  assert.match(html, /posthog\.init\("phc_test"/);
  assert.match(html, /api_host: "https:\/\/posthog\.example"/);
  assert.match(html, /window\.__odTrack/);
});

test('injectPostHog inserts the head snippet once', () => {
  const html = '<html><head><title>Open Design</title></head><body></body></html>';
  const once = injectPostHog(html, 'phc_test', undefined);
  const twice = injectPostHog(once, 'phc_test', undefined);

  assert.match(once, /posthog\.init\("phc_test"/);
  assert.equal((twice.match(/posthog\.init/g) ?? []).length, 1);
});

test('landing shells mount analytics components', async () => {
  const [
    home,
    subLayout,
    pluginIndex,
    pluginDetail,
    downloadPage,
    siteFooter,
  ] = await Promise.all([
    readLandingFile('app/pages/index.astro'),
    readLandingFile('app/_components/sub-page-layout.astro'),
    readLandingFile('app/pages/plugins/index.astro'),
    readLandingFile('app/pages/plugins/[...slug].astro'),
    readLandingFile('app/pages/download/index.astro'),
    readLandingFile('app/_components/site-footer.astro'),
  ]);

  for (const source of [home, subLayout, pluginIndex, pluginDetail]) {
    assert.match(source, /GoogleAnalytics/);
    assert.match(source, /PostHogAnalytics/);
  }

  assert.match(downloadPage, /download_click/);
  assert.match(siteFooter, /data-od-id=['"]footer['"]/);
  assert.doesNotMatch(siteFooter, /data-od-id=['"]sub-footer['"]/);
});
