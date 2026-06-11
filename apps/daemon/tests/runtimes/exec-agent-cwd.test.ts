import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { execAgentFile } from '../../src/runtimes/invocation.js';

const PRINT_CWD = 'process.stdout.write(process.cwd())';
const real = (p: string) => fs.realpathSync(p);

describe('execAgentFile cwd isolation', () => {
  it('defaults agent probes to a neutral cwd instead of the daemon process cwd', async () => {
    const { stdout } = await execAgentFile(process.execPath, ['-e', PRINT_CWD]);
    const childCwd = real(String(stdout).trim());

    expect(childCwd).toBe(real(os.tmpdir()));
    expect(childCwd).not.toBe(real(process.cwd()));
  });

  it('still honors an explicit cwd when the caller provides one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-agent-cwd-'));
    try {
      const { stdout } = await execAgentFile(process.execPath, ['-e', PRINT_CWD], { cwd: dir });
      expect(real(String(stdout).trim())).toBe(real(dir));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
