import { describe, expect, it, vi } from 'vitest';

import { applyClaudeStreamJsonRunBookkeeping } from '../src/server.js';

describe('applyClaudeStreamJsonRunBookkeeping', () => {
  it('keeps stdin open when usage reports a tool_use stop reason', () => {
    const stdinEnd = vi.fn();
    const run = {
      stdinOpen: true,
      pendingHostAnswers: new Set<string>(),
      turnCompletedCleanly: false,
      child: {
        stdin: {
          destroyed: false,
          end: stdinEnd,
        },
      },
    };

    applyClaudeStreamJsonRunBookkeeping(run, {
      type: 'usage',
      usage: { input_tokens: 6, output_tokens: 40831 },
      stopReason: 'tool_use',
    });

    expect(run.turnCompletedCleanly).toBe(false);
    expect(run.stdinOpen).toBe(true);
    expect(stdinEnd).not.toHaveBeenCalled();
  });
});
