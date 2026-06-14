import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const e2eRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(e2eRoot);
const desktopDocPath = join(workspaceRoot, 'docs', 'testing', 'e2e-coverage', 'desktop.md');

describe('packaged runtime parity documentation', () => {
  it('records the #27 packaged update matrix and sidecar environment contract', async () => {
    const doc = await readFile(desktopDocPath, 'utf8');

    for (const token of [
      '## #27 Packaged Runtime Update Matrix',
      '`macOS`',
      '`Windows`',
      '`Linux`',
      '`OD_PACKAGED_E2E_MAC=1`',
      '`OD_PACKAGED_E2E_WIN=1`',
      '`OD_PACKAGED_E2E_LINUX=1`',
      '`packaged_smoke_tauri_win`',
      '`packaged_smoke_tauri_linux`',
      'Windows NSIS update/reinstall',
      'unsupported update paths',
      '`OD_DATA_DIR`',
      '`NODE_USE_ENV_PROXY`',
      '`HTTP_PROXY`',
      '`HTTPS_PROXY`',
      '`NO_PROXY`',
      '`http_proxy`',
      '`https_proxy`',
      '`no_proxy`',
      '`LANG`',
      '`LC_ALL`',
      'host OS language',
    ]) {
      expect(doc).toContain(token);
    }
  });
});
