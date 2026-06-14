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
  'resolveAgentExecutable uses packaged built-in Vela when the bundled OpenCode companion is present',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'od-amr-built-in-'));
    try {
      return withEnvSnapshot(['PATH', 'OD_AGENT_HOME', 'OD_RESOURCE_ROOT', 'VELA_OPENCODE_BIN'], () => {
        const resourceRoot = join(root, 'resources', 'open-design');
        const builtInVela = join(resourceRoot, 'bin', 'vela');
        const companionTree = join(resourceRoot, 'bin', 'libexec', 'opencode');
        const companionExe = join(companionTree, 'opencode');
        mkdirSync(companionTree, { recursive: true });
        writeFileSync(builtInVela, '#!/bin/sh\nexit 0\n');
        writeFileSync(companionExe, '#!/bin/sh\nexit 0\n');
        chmodSync(builtInVela, 0o755);
        chmodSync(companionExe, 0o755);
        process.env.PATH = '';
        process.env.OD_AGENT_HOME = join(root, 'empty-home');
        process.env.OD_RESOURCE_ROOT = resourceRoot;
        delete process.env.VELA_OPENCODE_BIN;

        const resolved = resolveAgentExecutable(minimalAgentDef({ id: 'amr', bin: 'vela' }));

        assert.equal(resolved, builtInVela);
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

fsTest(
  'resolveAgentExecutable does not select packaged built-in Vela when OpenCode is missing',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'od-amr-built-in-no-opencode-'));
    try {
      return withEnvSnapshot(['PATH', 'OD_AGENT_HOME', 'OD_RESOURCE_ROOT', 'VELA_OPENCODE_BIN'], () => {
        const resourceRoot = join(root, 'resources', 'open-design');
        const builtInVela = join(resourceRoot, 'bin', 'vela');
        mkdirSync(join(resourceRoot, 'bin'), { recursive: true });
        writeFileSync(builtInVela, '#!/bin/sh\nexit 0\n');
        chmodSync(builtInVela, 0o755);
        process.env.PATH = '';
        process.env.OD_AGENT_HOME = join(root, 'empty-home');
        process.env.OD_RESOURCE_ROOT = resourceRoot;
        delete process.env.VELA_OPENCODE_BIN;

        const resolved = resolveAgentExecutable(minimalAgentDef({ id: 'amr', bin: 'vela' }));

        assert.equal(resolved, null);
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

fsTest(
  'resolveAgentExecutable prefers configured VELA_BIN over packaged built-in Vela',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'od-amr-built-in-precedence-'));
    try {
      return withEnvSnapshot(['PATH', 'OD_AGENT_HOME', 'OD_RESOURCE_ROOT'], () => {
        const resourceRoot = join(root, 'resources', 'open-design');
        const builtInVela = join(resourceRoot, 'bin', 'vela');
        const companionTree = join(resourceRoot, 'bin', 'libexec', 'opencode');
        const companionExe = join(companionTree, 'opencode');
        const configuredVela = join(root, 'configured', 'vela');
        mkdirSync(companionTree, { recursive: true });
        mkdirSync(join(root, 'configured'), { recursive: true });
        writeFileSync(builtInVela, '#!/bin/sh\nexit 0\n');
        writeFileSync(companionExe, '#!/bin/sh\nexit 0\n');
        writeFileSync(configuredVela, '#!/bin/sh\nexit 0\n');
        chmodSync(builtInVela, 0o755);
        chmodSync(companionExe, 0o755);
        chmodSync(configuredVela, 0o755);
        process.env.PATH = '';
        process.env.OD_AGENT_HOME = join(root, 'empty-home');
        process.env.OD_RESOURCE_ROOT = resourceRoot;

        const resolved = resolveAgentExecutable(
          minimalAgentDef({ id: 'amr', bin: 'vela' }),
          { VELA_BIN: configuredVela },
        );

        assert.equal(resolved, configuredVela);
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
