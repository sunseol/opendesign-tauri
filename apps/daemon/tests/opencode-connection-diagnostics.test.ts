import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { testAgentConnection } from '../src/connectionTest.js';

async function withFakeOpenCode<T>(script: string, run: (bin: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'od-opencode-diagnostic-'));
  try {
    const bin = path.join(dir, process.platform === 'win32' ? 'opencode.cmd' : 'opencode');
    if (process.platform === 'win32') {
      const runner = path.join(dir, 'opencode-test-runner.cjs');
      await fsp.writeFile(runner, script);
      await fsp.writeFile(bin, `@echo off\r\nnode "${runner}" %*\r\n`);
    } else {
      await fsp.writeFile(bin, `#!/usr/bin/env node\n${script}`);
      await fsp.chmod(bin, 0o755);
    }
    return await run(bin);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

describe('OpenCode connection diagnostics', () => {
  it('suggests updating opencode-ai when an outdated CLI rejects the JSON run format', async () => {
    await withFakeOpenCode(
      `
const args = process.argv.slice(2);
if (args[0] === '--version') {
  console.log('opencode-cli 1.0.0');
  process.exit(0);
}
if (args[0] === 'models') {
  console.log('openai/gpt-5');
  process.exit(0);
}
console.error(
  ', json) (default "text") -p, --prompt string Prompt to run in non-interactive mode ' +
  '-q, --quiet Hide spinner in non-interactive mode -v, --version Version.',
);
process.exit(1);
`,
      async (bin) => {
        const result = await testAgentConnection({
          agentId: 'opencode',
          agentCliEnv: { opencode: { OPENCODE_BIN: bin } },
        });

        expect(result).toMatchObject({
          ok: false,
          kind: 'agent_spawn_failed',
          agentName: 'OpenCode',
        });
        expect(result.detail).toContain('OpenCode CLI appears to be outdated');
        expect(result.detail).toContain('npm i -g opencode-ai@latest');
      },
    );
  });
});
