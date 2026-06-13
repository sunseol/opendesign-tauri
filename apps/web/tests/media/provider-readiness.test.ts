import { describe, expect, it } from 'vitest';

import {
  isMediaModelPickerReady,
  isMediaProviderPickerReady,
} from '../../src/media/provider-readiness';
import type { MediaProviderCredentials } from '../../src/types';

describe('media provider picker readiness', () => {
  it('allows integrated providers before config has loaded', () => {
    expect(isMediaProviderPickerReady('openai')).toBe(true);
  });

  it('keeps credentialless integrated providers available', () => {
    expect(isMediaProviderPickerReady('hyperframes', {})).toBe(true);
  });

  it('keeps non-integrated providers unavailable', () => {
    expect(isMediaProviderPickerReady('bfl', {})).toBe(false);
  });

  it('enables AIHubMix only after media credentials are configured', () => {
    expect(isMediaProviderPickerReady('aihubmix', {})).toBe(false);
    expect(isMediaProviderPickerReady('aihubmix', {
      aihubmix: {
        apiKey: '',
        baseUrl: '',
        apiKeyConfigured: true,
      },
    })).toBe(true);
  });

  it('does not treat OAuth-only OpenAI auth as media credentials', () => {
    const providers: Record<string, MediaProviderCredentials> = {
      openai: {
        apiKey: '',
        baseUrl: '',
        source: 'oauth-codex',
      },
    };

    expect(isMediaProviderPickerReady('openai', providers)).toBe(false);
    expect(isMediaModelPickerReady('gpt-image-2', providers)).toBe(false);
  });

  it('accepts a daemon-restored OpenAI media key marker without OAuth source', () => {
    const providers: Record<string, MediaProviderCredentials> = {
      openai: {
        apiKey: '',
        baseUrl: '',
        apiKeyConfigured: true,
      },
    };

    expect(isMediaProviderPickerReady('openai', providers)).toBe(true);
  });
});
