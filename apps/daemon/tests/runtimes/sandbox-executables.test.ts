import { test } from 'vitest';
import {
  assert,
  chmodSync,
  join,
  minimalAgentDef,
  mkdirSync,
  mkdtempSync,
  resolveAgentExecutable,
  rmSync,
  tmpdir,
  withEnvSnapshot,
  writeFileSync,
} from './helpers/test-helpers.js';

const fsTest = process.platform === 'win32' ? test.skip : test;

fsTest(
  'OD_SANDBOX_MODE isolates executable resolution from host OD_AGENT_HOME',
  () => withEnvSnapshot(
    ['PATH', 'OD_AGENT_HOME', 'OD_SANDBOX_MODE', 'OD_DATA_DIR'],
    () => {
      const root = mkdtempSync(join(tmpdir(), 'od-agents-sandbox-mode-'));
      const hostHome = join(root, 'host-home');
      const dataDir = join(root, 'data');
      const hostBinDir = join(hostHome, '.npm-global', 'bin');
      try {
        mkdirSync(hostBinDir, { recursive: true });
        writeFileSync(join(hostBinDir, 'gemini'), '');
        chmodSync(join(hostBinDir, 'gemini'), 0o755);

        process.env.OD_SANDBOX_MODE = '1';
        process.env.OD_DATA_DIR = dataDir;
        process.env.OD_AGENT_HOME = hostHome;
        process.env.PATH = '/usr/bin:/bin';

        const resolved = resolveAgentExecutable(minimalAgentDef({ bin: 'gemini' }));
        assert.equal(resolved, null);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  ),
);
