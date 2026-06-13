import { describe, expect, it } from 'vitest';
import { kimiAgentDef } from '../../src/runtimes/defs/kimi.js';

describe('Kimi runtime definition', () => {
  it('uses prompt-mode stream-json instead of ACP session/new', () => {
    const args = kimiAgentDef.buildArgs(
      'write the smoke file',
      [],
      [],
      { model: 'kimi-code/kimi-for-coding' },
    );

    expect(args).toEqual([
      '-p',
      'write the smoke file',
      '--output-format',
      'stream-json',
      '-m',
      'kimi-code/kimi-for-coding',
    ]);
    expect(kimiAgentDef.streamFormat).toBe('json-event-stream');
    expect(kimiAgentDef.eventParser).toBe('kimi');
    expect('promptViaStdin' in kimiAgentDef).toBe(false);
    expect('fetchModels' in kimiAgentDef).toBe(false);
    expect('externalMcpInjection' in kimiAgentDef).toBe(false);
  });
});
