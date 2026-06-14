import { describe, expect, it } from 'vitest';

import { canFetchProviderModels } from '../../src/components/SettingsDialog';

describe('SettingsDialog BYOK validation preconditions', () => {
  it('blocks first-party model fetches when the API key belongs to another provider', () => {
    expect(
      canFetchProviderModels(
        { apiKey: 'sk-ant-test', baseUrl: 'https://api.openai.com/v1' },
        'openai',
      ),
    ).toBe(false);
    expect(
      canFetchProviderModels(
        { apiKey: 'sk-openai-test', baseUrl: 'https://api.anthropic.com' },
        'anthropic',
      ),
    ).toBe(false);
    expect(
      canFetchProviderModels(
        { apiKey: 'sk-openai-test', baseUrl: 'https://generativelanguage.googleapis.com' },
        'google',
      ),
    ).toBe(false);
  });

  it('allows OpenRouter model fetches to use OpenAI-shaped keys on the OpenRouter host', () => {
    expect(
      canFetchProviderModels(
        { apiKey: 'sk-or-test', baseUrl: 'https://openrouter.ai/api/v1' },
        'openrouter',
      ),
    ).toBe(true);
  });
});
