import { describe, expect, it } from 'vitest';

import { providerModelsCacheKey } from '../../src/components/SettingsDialog';

describe('provider model cache helpers', () => {
  it('builds provider model cache keys without raw API keys', () => {
    const key = providerModelsCacheKey(
      'anthropic',
      'https://api.anthropic.com/',
      'sk-secret-value',
    );

    expect(key).toContain('https://api.anthropic.com');
    expect(key).not.toContain('sk-secret-value');
    expect(key).toBe(
      providerModelsCacheKey(
        'anthropic',
        'https://api.anthropic.com',
        'sk-secret-value',
      ),
    );
  });

  it('keeps OpenRouter model cache entries separate from generic OpenAI hosts', () => {
    const openRouterKey = providerModelsCacheKey(
      'openrouter',
      'https://openrouter.ai/api/v1',
      'sk-or-secret',
    );

    expect(openRouterKey).toContain('openrouter');
    expect(openRouterKey).not.toContain('sk-or-secret');
    expect(openRouterKey).not.toBe(
      providerModelsCacheKey(
        'openai',
        'https://openrouter.ai/api/v1',
        'sk-or-secret',
      ),
    );
  });
});
