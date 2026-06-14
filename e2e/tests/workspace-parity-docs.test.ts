import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const e2eRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(e2eRoot);
const workspaceDocPath = join(workspaceRoot, 'docs', 'testing', 'e2e-coverage', 'workspace.md');

describe('workspace parity documentation', () => {
  it('records the #26 Studio editing parity contract and coverage owners', async () => {
    const doc = await readFile(workspaceDocPath, 'utf8');

    for (const token of [
      '## #26 Studio Editing Parity',
      'survive navigation and reload',
      'staged design file visibility',
      'deck/comment marker flow',
      'comment marker tracking',
      'manual edit inspector',
      'viewer modals',
      'composer/workspace chrome',
      'mention highlight overlay',
      '`design-files-tab-persistence`',
      '`comment-attachment-flow`',
      '`deck-pagination-next-prev-correctness`',
      '`deck-pagination-per-file-isolated`',
      '`e2e/ui/app-manual-edit.test.ts`',
      '`apps/web/tests/comments.test.ts`',
      '`apps/web/tests/components/DesignSystemPreviewModal.layering.test.tsx`',
      '`apps/web/tests/styles/project-design-system-picker.test.ts`',
      '`apps/web/tests/styles/studio-overlay-layering.test.ts`',
      '`apps/web/tests/components/ChatComposer.context-pickers.test.tsx`',
      '`apps/web/tests/styles/home-hero-prompt-metrics.test.ts`',
    ]) {
      expect(doc).toContain(token);
    }
  });
});
