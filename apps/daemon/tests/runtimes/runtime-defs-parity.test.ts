import { describe, expect, it } from 'vitest';

import {
  copilot,
  cursorAgent,
} from './helpers/test-helpers.js';
import { resolveChatRunInactivityTimeoutMs } from '../../src/server.js';
import { probeAgentAuthStatus } from '../../src/runtimes/auth.js';

describe('runtime definition parity', () => {
  it('gives Copilot long silent generations a bounded inactivity window', () => {
    expect(copilot.inactivityTimeoutMs).toBe(30 * 60 * 1000);
  });

  it('declares Cursor Agent status as the auth probe', () => {
    expect(cursorAgent.authProbe).toEqual({
      args: ['status'],
      timeoutMs: 5000,
    });
  });

  it('uses runtime inactivity defaults unless the operator env overrides them', () => {
    const previous = process.env.OD_CHAT_RUN_INACTIVITY_TIMEOUT_MS;
    try {
      delete process.env.OD_CHAT_RUN_INACTIVITY_TIMEOUT_MS;
      expect(resolveChatRunInactivityTimeoutMs(copilot.inactivityTimeoutMs)).toBe(30 * 60 * 1000);

      process.env.OD_CHAT_RUN_INACTIVITY_TIMEOUT_MS = '1234';
      expect(resolveChatRunInactivityTimeoutMs(copilot.inactivityTimeoutMs)).toBe(1234);
    } finally {
      if (previous == null) {
        delete process.env.OD_CHAT_RUN_INACTIVITY_TIMEOUT_MS;
      } else {
        process.env.OD_CHAT_RUN_INACTIVITY_TIMEOUT_MS = previous;
      }
    }
  });

  it('runs declarative auth probes from the runtime definition', async () => {
    await expect(probeAgentAuthStatus({
      id: 'fixture-agent',
      name: 'Fixture Agent',
      authProbe: {
        args: ['-e', 'process.stdout.write("ok")'],
        timeoutMs: 5000,
      },
    }, process.execPath, process.env)).resolves.toEqual({ status: 'ok' });
  });
});
