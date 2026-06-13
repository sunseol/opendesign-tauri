import { describe, expect, it } from 'vitest';

import { findMediaModel, mediaModelProviderId } from '../../src/media/models';

describe('mediaModelProviderId', () => {
  it('resolves AIHubMix live-catalogue ids by prefix without the static registry', () => {
    expect(mediaModelProviderId('aihubmix-qwen-image-2-pro')).toBe('aihubmix');
    expect(mediaModelProviderId('aihubmix-doubao-seedance-2-0-260128')).toBe('aihubmix');
  });

  it('resolves static models to their registry provider', () => {
    expect(mediaModelProviderId('gpt-image-2')).toBe('openai');
    expect(findMediaModel('aihubmix-gpt-image-1')?.provider).toBe('aihubmix');
    expect(mediaModelProviderId('aihubmix-gpt-image-1')).toBe('aihubmix');
    expect(mediaModelProviderId('senseaudio-image-2.0-260319')).toBe('senseaudio');
    expect(mediaModelProviderId('senseaudio-tts')).toBe('senseaudio');
  });

  it('returns undefined for unknown ids', () => {
    expect(mediaModelProviderId('totally-made-up-model')).toBeUndefined();
    expect(mediaModelProviderId('')).toBeUndefined();
  });
});
