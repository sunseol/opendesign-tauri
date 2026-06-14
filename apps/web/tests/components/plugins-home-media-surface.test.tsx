// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MediaSurface } from '../../src/components/plugins-home/cards/MediaSurface';
import type { MediaPreviewSpec } from '../../src/components/plugins-home/preview';

const BAKED_CLIP: MediaPreviewSpec = {
  kind: 'media',
  mediaType: 'video',
  poster: 'https://example.invalid/poster.jpg',
  videoUrl: 'https://example.invalid/clip.mp4',
  audioUrl: null,
  imageOnly: false,
  loopHoldMs: 2500,
};

afterEach(() => {
  cleanup();
});

describe('MediaSurface baked clip preload', () => {
  it('warms baked preview clips before they enter the visible playback zone', () => {
    const { container } = render(
      <MediaSurface preview={BAKED_CLIP} pluginTitle="Preview clip" inView={true} visible={false} />,
    );

    const video = container.querySelector('video.plugins-home__media-video');
    expect(video?.getAttribute('preload')).toBe('auto');
  });
});
