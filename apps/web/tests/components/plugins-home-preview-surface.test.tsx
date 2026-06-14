// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewSurface } from '../../src/components/plugins-home/cards/PreviewSurface';
import type { MediaPreviewSpec } from '../../src/components/plugins-home/preview';

const visibilityQueue = vi.hoisted<boolean[]>(() => []);

vi.mock('../../src/components/plugins-home/useInView', () => ({
  useInView: () => ({
    ref: { current: null },
    inView: visibilityQueue.shift() ?? false,
  }),
}));

type MockMediaSurfaceProps = {
  readonly inView: boolean;
  readonly visible?: boolean;
};

vi.mock('../../src/components/plugins-home/cards/MediaSurface', () => ({
  MediaSurface: ({ inView, visible }: MockMediaSurfaceProps) => (
    <div data-testid="media-surface" data-in-view={String(inView)} data-visible={String(visible)} />
  ),
}));

vi.mock('../../src/components/plugins-home/cards/HtmlSurface', () => ({
  HtmlSurface: ({ inView }: { readonly inView: boolean }) => (
    <div data-testid="html-surface" data-in-view={String(inView)} />
  ),
}));

vi.mock('../../src/components/plugins-home/cards/DesignSystemSurface', () => ({
  DesignSystemSurface: () => <div data-testid="design-surface" />,
}));

vi.mock('../../src/components/plugins-home/cards/TextSurface', () => ({
  TextSurface: () => <div data-testid="text-surface" />,
}));

const IMAGE_PREVIEW: MediaPreviewSpec = {
  kind: 'media',
  mediaType: 'image',
  poster: 'https://example.invalid/poster.jpg',
  videoUrl: null,
  audioUrl: null,
  imageOnly: true,
};

const BAKED_CLIP_PREVIEW: MediaPreviewSpec = {
  ...IMAGE_PREVIEW,
  mediaType: 'video',
  videoUrl: 'https://example.invalid/baked.mp4',
  imageOnly: false,
  loopHoldMs: 2500,
};

afterEach(() => {
  cleanup();
  visibilityQueue.splice(0, visibilityQueue.length);
});

describe('PreviewSurface baked clip visibility gates', () => {
  it('uses the wide keepalive margin only for baked hover-pan clips', () => {
    visibilityQueue.splice(0, visibilityQueue.length, false, true, false, true);
    render(
      <PreviewSurface pluginId="sample" pluginTitle="Sample" preview={BAKED_CLIP_PREVIEW} />,
    );

    const media = screen.getByTestId('media-surface');
    expect(media.dataset.inView).toBe('false');
    expect(media.dataset.visible).toBe('true');
    cleanup();

    visibilityQueue.splice(0, visibilityQueue.length, false, true, false, true);
    render(
      <PreviewSurface pluginId="sample" pluginTitle="Sample" preview={IMAGE_PREVIEW} />,
    );

    expect(screen.getByTestId('media-surface').dataset.inView).toBe('true');
  });
});
