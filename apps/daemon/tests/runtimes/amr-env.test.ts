import assert from 'node:assert/strict';
import { test } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  spawnEnvForAgent,
  withEnvSnapshot,
} from './helpers/test-helpers.js';
import { openDesignAmrTraceEnv } from '../../src/runtimes/env.js';

test('spawnEnvForAgent adds AMR Vela attribution and isolated OpenCode defaults', () => {
  const env = spawnEnvForAgent('amr', {
    OD_DATA_DIR: '/tmp/open-design-data',
    OPEN_DESIGN_AMR_PROFILE: 'local',
    PATH: '/usr/bin',
  });

  assert.equal(env.AMR_CLIENT_SOURCE, 'open_design');
  assert.equal(env.VELA_PROFILE, 'local');
  assert.equal(
    env.OPENCODE_TEST_HOME,
    join('/tmp/open-design-data', 'amr', 'opencode-home'),
  );
  assert.equal(env.PATH, '/usr/bin');
});

test('spawnEnvForAgent preserves explicit AMR source and OpenCode home overrides', () => {
  const env = spawnEnvForAgent(
    'amr',
    {
      OD_DATA_DIR: '/tmp/open-design-data',
      AMR_CLIENT_SOURCE: 'custom_host',
      OPENCODE_TEST_HOME: '/tmp/custom-opencode-home',
    },
    {
      VELA_LINK_URL: 'https://openrouter.example/v1',
    },
  );

  assert.equal(env.AMR_CLIENT_SOURCE, 'custom_host');
  assert.equal(env.OPENCODE_TEST_HOME, '/tmp/custom-opencode-home');
  assert.equal(env.VELA_LINK_URL, 'https://openrouter.example/v1');
});

test('spawnEnvForAgent backfills HOME for AMR when daemon env is stripped', () => {
  return withEnvSnapshot(['HOME'], () => {
    delete process.env.HOME;
    const env = spawnEnvForAgent('amr', { PATH: '/usr/bin' });

    assert.equal(env.HOME, homedir());
  });
});

test('openDesignAmrTraceEnv builds Open Design trace identity env for AMR only', () => {
  const amrEnv = openDesignAmrTraceEnv({
    agentId: 'amr',
    runId: ' run_trace_123 ',
    runAttempt: 2,
    conversationId: ' conversation_trace_456 ',
  });

  assert.equal(amrEnv.OPEN_DESIGN_RUN_ID, 'run_trace_123');
  assert.equal(amrEnv.OPEN_DESIGN_RUN_ATTEMPT, '2');
  assert.equal(amrEnv.OPEN_DESIGN_SESSION_ID, 'conversation_trace_456');

  const claudeEnv = openDesignAmrTraceEnv({
    agentId: 'claude',
    runId: 'run_trace_123',
    runAttempt: 2,
    conversationId: 'conversation_trace_456',
  });

  assert.deepEqual(claudeEnv, {});
});

test('openDesignAmrTraceEnv omits optional AMR session trace env when no conversation exists', () => {
  const env = openDesignAmrTraceEnv({
    agentId: 'amr',
    runId: 'run_trace_no_session',
    runAttempt: 0,
  });

  assert.equal(env.OPEN_DESIGN_RUN_ID, 'run_trace_no_session');
  assert.equal(env.OPEN_DESIGN_RUN_ATTEMPT, '0');
  assert.equal(env.OPEN_DESIGN_SESSION_ID, undefined);
});

test('openDesignAmrTraceEnv fails fast on invalid AMR trace inputs', () => {
  assert.throws(
    () => openDesignAmrTraceEnv({ agentId: 'amr', runId: ' ', runAttempt: 0 }),
    /OPEN_DESIGN_RUN_ID/,
  );
  assert.throws(
    () => openDesignAmrTraceEnv({
      agentId: 'amr',
      runId: 'run_trace',
      runAttempt: -1,
    }),
    /OPEN_DESIGN_RUN_ATTEMPT/,
  );
});
