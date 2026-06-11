import { describe, expect, it } from 'vitest';

import {
  buildOpenAIChatTokenParam,
  isUnsupportedMaxTokensError,
  usesMaxCompletionTokens,
} from '../src/openai-chat-token-params.js';

describe('OpenAI chat token params', () => {
  it.each(['gpt-5', 'gpt-5.1', 'gpt-5-mini', 'o1-preview', 'o3-mini', 'o4'])(
    'uses max_completion_tokens for %s',
    (model) => {
      expect(usesMaxCompletionTokens(model)).toBe(true);
      expect(buildOpenAIChatTokenParam(model, 123)).toEqual({ max_completion_tokens: 123 });
    },
  );

  it.each(['gpt-4o', 'gpt-4.1', 'deepseek-chat', 'claude-opus'])(
    'keeps max_tokens for generic compatible model %s',
    (model) => {
      expect(usesMaxCompletionTokens(model)).toBe(false);
      expect(buildOpenAIChatTokenParam(model, 123)).toEqual({ max_tokens: 123 });
    },
  );

  it('recognizes provider errors that request max_completion_tokens', () => {
    expect(
      isUnsupportedMaxTokensError(
        "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
      ),
    ).toBe(true);
    expect(isUnsupportedMaxTokensError('bad API key')).toBe(false);
  });
});
