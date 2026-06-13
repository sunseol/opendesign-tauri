import { describe, expect, it } from 'vitest';
import {
  apiProtocolLabel,
  apiProtocolModelLabel,
  usesAnthropicProxy,
} from '../../src/utils/apiProtocol';
import type { AppConfig } from '../../src/types';
import {
  agentDisplayName,
  agentIconId,
  agentModelDisplayName,
  exactAgentDisplayName,
} from '../../src/utils/agentLabels';

describe('api protocol labels', () => {
  it('labels the selected API protocol instead of assuming Anthropic', () => {
    expect(apiProtocolLabel('openai')).toBe('OpenAI API');
    expect(apiProtocolLabel('google')).toBe('Google Gemini');
    expect(apiProtocolLabel(undefined)).toBe('Anthropic API');
  });

  it('includes the selected model when labeling API assistant messages', () => {
    expect(apiProtocolModelLabel('openai', 'google/gemma-4-e4b')).toBe(
      'OpenAI API · google/gemma-4-e4b',
    );
    expect(apiProtocolModelLabel('azure', '  ')).toBe('Azure OpenAI');
  });

  it('routes only Anthropic-compatible custom API configs to the Anthropic proxy', () => {
    expect(usesAnthropicProxy(apiConfig({
      apiProtocol: 'aihubmix',
      baseUrl: 'https://aihubmix.com/v1',
      model: 'gpt-5.5',
    }))).toBe(false);
    expect(usesAnthropicProxy(apiConfig({
      apiProtocol: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    }))).toBe(false);
    expect(usesAnthropicProxy(apiConfig({
      apiProtocol: 'anthropic',
      baseUrl: 'https://anthropic-compatible.example',
      model: 'claude-compatible',
    }))).toBe(true);
    expect(usesAnthropicProxy(apiConfig({
      apiProtocol: undefined,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    }))).toBe(false);
  });

  it('includes explicit local CLI models when labeling agent messages', () => {
    expect(agentModelDisplayName('claude', 'Claude Code', 'claude-sonnet-4-6')).toBe(
      'Claude · claude-sonnet-4-6',
    );
    expect(agentModelDisplayName('claude', 'Claude Code', 'default')).toBe('Claude');
  });

  it('normalizes Qoder local CLI ids, aliases, and executable paths', () => {
    expect(agentDisplayName('qoder')).toBe('Qoder');
    expect(exactAgentDisplayName('qodercli')).toBe('Qoder');
    expect(exactAgentDisplayName('Qoder CLI')).toBe('Qoder');
    expect(agentDisplayName('/opt/homebrew/bin/qodercli')).toBe('Qoder');
    expect(agentDisplayName('C:\\Tools\\qodercli.cmd')).toBe('Qoder');
  });

  it('normalizes Amp aliases without matching unrelated words', () => {
    expect(agentDisplayName('amp')).toBe('Amp');
    expect(exactAgentDisplayName('Amp CLI')).toBe('Amp');
    expect(exactAgentDisplayName('amp-cli')).toBe('Amp');
    expect(agentDisplayName('/opt/homebrew/bin/amp')).toBe('Amp');
    expect(agentDisplayName('example-agent')).toBe('example-agent');
  });

  it('normalizes Codebuddy local CLI ids and aliases', () => {
    expect(agentDisplayName('codebuddy')).toBe('Codebuddy');
    expect(exactAgentDisplayName('Codebuddy Code')).toBe('Codebuddy');
    expect(exactAgentDisplayName('cbc')).toBe('Codebuddy');
    expect(agentDisplayName('/usr/local/bin/codebuddy')).toBe('Codebuddy');
  });

  it('maps agent identifiers to stable icon ids without dropping local aliases', () => {
    expect(agentIconId('/opt/homebrew/bin/qodercli')).toBe('qoder');
    expect(agentIconId(null, 'Claude Code · claude-sonnet-4-6')).toBe('claude');
    expect(agentIconId('agy')).toBe('antigravity');
    expect(agentIconId('codebuddy')).toBe('codebuddy');
    expect(agentIconId('custom-agent')).toBe('custom-agent');
  });

  it('includes explicit Qoder models but hides the default model', () => {
    expect(agentModelDisplayName('qoder', 'Qoder CLI', 'ultimate')).toBe('Qoder · ultimate');
    expect(agentModelDisplayName('qoder', 'Qoder CLI', 'default')).toBe('Qoder');
  });
});

function apiConfig(patch: Partial<AppConfig>): AppConfig {
  return {
    mode: 'api',
    apiKey: 'sk-test',
    apiProtocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    ...patch,
  };
}
