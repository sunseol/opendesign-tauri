import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getPublicPlugins } from '../app/plugin-registry';

test('plugin registry exposes live HTML previews for example plugins', () => {
  const plugins = getPublicPlugins();
  const report = plugins.find((plugin) => plugin.id === 'open-design/example-data-report');

  assert.ok(report);
  assert.equal(report.preview?.type, 'html');
  assert.equal(report.preview?.label, 'Live HTML preview');
  assert.equal(report.preview?.frameHref, '/plugins/previews/open-design/example-data-report/');
  assert.match(report.preview?.localHtmlPath ?? '', /plugins\/_official\/examples\/data-report\/example\.html$/);
});

test('short example plugins use live HTML previews without clip hold loops', () => {
  const plugins = getPublicPlugins();
  const prototype = plugins.find((plugin) => plugin.id === 'open-design/example-web-prototype');

  assert.ok(prototype);
  assert.equal(prototype.preview?.type, 'html');
  assert.equal(prototype.preview?.label, 'Live HTML preview');
  assert.equal(prototype.preview?.frameHref, '/plugins/previews/open-design/example-web-prototype/');
  assert.match(prototype.preview?.localHtmlPath ?? '', /plugins\/_official\/examples\/web-prototype\/example\.html$/);
});
