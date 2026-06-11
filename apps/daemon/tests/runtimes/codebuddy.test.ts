import { beforeEach, describe, expect, it } from 'vitest';
import { codebuddyAgentDef } from '../../src/runtimes/defs/codebuddy.js';
import { agentCapabilities } from '../../src/runtimes/capabilities.js';
import { getAgentDef } from '../../src/runtimes/registry.js';

describe('codebuddy runtime adapter', () => {
  beforeEach(() => {
    agentCapabilities.delete('codebuddy');
  });

  it('is registered with the runtime registry', () => {
    expect(getAgentDef('codebuddy')).toBe(codebuddyAgentDef);
  });

  it('uses Claude-compatible stream-json over stdin without embedding the prompt in argv', () => {
    const longPrompt = 'x'.repeat(200_000);
    const args = codebuddyAgentDef.buildArgs(longPrompt, [], [], {});

    expect(codebuddyAgentDef.promptViaStdin).toBe(true);
    expect(codebuddyAgentDef.promptInputFormat).toBe('stream-json');
    expect(codebuddyAgentDef.streamFormat).toBe('claude-stream-json');
    expect(args).not.toContain(longPrompt);
    expect(args).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
    ]);
  });

  it('maps model and reasoning selections onto Codebuddy flags', () => {
    const args = codebuddyAgentDef.buildArgs('', [], [], {
      model: 'glm-5.1-ioa',
      reasoning: 'xhigh',
    });

    expect(args[args.indexOf('--model') + 1]).toBe('glm-5.1-ioa');
    expect(args[args.indexOf('--effort') + 1]).toBe('xhigh');
  });

  it('omits model and effort flags for the synthetic default selections', () => {
    const args = codebuddyAgentDef.buildArgs('', [], [], {
      model: 'default',
      reasoning: 'default',
    });

    expect(args).not.toContain('--model');
    expect(args).not.toContain('--effort');
  });

  it('uses probed capabilities for partial messages and add-dir support', () => {
    agentCapabilities.set('codebuddy', { partialMessages: true, addDir: true });
    const args = codebuddyAgentDef.buildArgs('', [], ['/repo/skills'], {});

    expect(args).toContain('--include-partial-messages');
    expect(args[args.indexOf('--add-dir') + 1]).toBe('/repo/skills');
  });

  it('does not pass add-dir when the probed CLI lacks support', () => {
    agentCapabilities.set('codebuddy', { addDir: false });
    const args = codebuddyAgentDef.buildArgs('', [], ['/repo/skills'], {});

    expect(args).not.toContain('--add-dir');
  });

  it('declares fallback binary, MCP injection, and multi-provider model hints', () => {
    expect(codebuddyAgentDef.fallbackBins).toEqual(['cbc']);
    expect(codebuddyAgentDef.externalMcpInjection).toBe('claude-mcp-json');
    expect(codebuddyAgentDef.helpArgs).toEqual(['-p', '--help']);

    const modelIds = codebuddyAgentDef.fallbackModels.map((model) => model.id);
    expect(modelIds).toEqual(expect.arrayContaining([
      'default',
      'glm-5.1-ioa',
      'claude-opus-4.8',
      'gpt-5.5',
      'gemini-3.5-flash',
      'deepseek-v4-pro-ioa',
      'kimi-k2.6-ioa',
      'minimax-m3-ioa',
    ]));
  });
});
