import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getPublicPlugins } from '../app/plugin-registry';

test('plugin registry backfills landing previews from baked clip metadata', () => {
  const plugins = getPublicPlugins();
  const report = plugins.find((plugin) => plugin.id === 'open-design/example-data-report');

  assert.ok(report);
  assert.equal(report.preview?.type, 'video');
  assert.match(
    report.preview?.video ?? '',
    /^https:\/\/repo-assets\.open-design\.ai\/plugin-previews\/example-data-report\.[a-f0-9]{16}\.mp4$/,
  );
  assert.match(
    report.preview?.poster ?? '',
    /^https:\/\/repo-assets\.open-design\.ai\/plugin-previews\/example-data-report\.[a-f0-9]{16}\.poster\.jpg$/,
  );
  assert.equal(report.preview?.holdMs, 2500);
});

test('short baked clips do not expose an out-of-range hold loop', () => {
  const plugins = getPublicPlugins();
  const prototype = plugins.find((plugin) => plugin.id === 'open-design/example-web-prototype');

  assert.ok(prototype);
  assert.equal(prototype.preview?.type, 'video');
  assert.match(
    prototype.preview?.video ?? '',
    /^https:\/\/repo-assets\.open-design\.ai\/plugin-previews\/example-web-prototype\.[a-f0-9]{16}\.mp4$/,
  );
  assert.equal(prototype.preview?.holdMs, undefined);
});
