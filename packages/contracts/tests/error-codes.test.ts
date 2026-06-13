import { describe, expect, it } from 'vitest';

import { API_ERROR_CODES, type ApiErrorCode } from '../src/errors';

describe('shared API error codes', () => {
  it('exposes AGENT_RUNTIME_DEF_INVALID for runtime-def validation failures', () => {
    expect(API_ERROR_CODES).toContain('AGENT_RUNTIME_DEF_INVALID');
  });

  it('keeps AGENT_RUNTIME_DEF_INVALID assignable to ApiErrorCode', () => {
    const code: ApiErrorCode = 'AGENT_RUNTIME_DEF_INVALID';
    expect(code).toBe('AGENT_RUNTIME_DEF_INVALID');
  });

  it('exposes media execution denial codes for agent tool envelopes', () => {
    expect(API_ERROR_CODES).toEqual(
      expect.arrayContaining([
        'MEDIA_EXECUTION_DISABLED',
        'MEDIA_SURFACE_DENIED',
        'MEDIA_MODEL_DENIED',
      ]),
    );
  });
});
