import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FAKE_AGENT_RUNTIME_IDS } from '@/fake-agents';

const e2eRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(e2eRoot);
const statusDocPath = join(workspaceRoot, 'docs', 'testing', 'e2e-coverage', 'status.md');

describe('P0 smoke suite documentation', () => {
  it('records the #28 P0 smoke suite across runtime surfaces', async () => {
    const doc = await readFile(statusDocPath, 'utf8');

    for (const token of [
      '## #28 P0 Smoke Suite',
      '`web`',
      '`daemon`',
      '`desktop`',
      '`packaged`',
      '`pnpm -C e2e exec tsx scripts/ui-p0-shards.ts smoke`',
      '`pnpm -C e2e run test:p0`',
      '`e2e/specs/mac.spec.ts`',
      '`packaged_smoke_tauri_win`',
      '`packaged_smoke_tauri_linux`',
    ]) {
      expect(doc).toContain(token);
    }
  });

  it('records the replay fake-agent matrix and CI alert distinction', async () => {
    const doc = await readFile(statusDocPath, 'utf8');
    const documentedAgents = ['codex', ...FAKE_AGENT_RUNTIME_IDS] as const;

    for (const agentId of documentedAgents) {
      expect(doc).toContain(`\`${agentId}\``);
    }

    for (const token of [
      '.github/workflows/notify-main-ci-feishu.yml',
      '.github/workflows/fork-pr-workflow-approval.yml',
      'code failure',
      'maintainer workflow approval waiting',
    ]) {
      expect(doc).toContain(token);
    }
  });
});
