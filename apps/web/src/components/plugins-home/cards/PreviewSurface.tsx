// Switchboard component that renders the right preview surface
// for a plugin card based on the inferred preview kind.
//
// The surface is the visual hero of every card. It lazy-mounts
// expensive content (iframes, network images, video poll loops)
// via IntersectionObserver so a 350-plugin gallery does not
// hammer the daemon on first paint. The text-fallback variant
// short-circuits the lazy mount because it has no off-screen cost.

import { useCallback } from 'react';
import type { PluginPreviewSpec } from '../preview';
import { useInView } from '../useInView';
import { DesignSystemSurface } from './DesignSystemSurface';
import { HtmlSurface } from './HtmlSurface';
import { MediaSurface } from './MediaSurface';
import { TextSurface } from './TextSurface';

interface Props {
  pluginId: string;
  pluginTitle: string;
  preview: PluginPreviewSpec;
}

export function PreviewSurface({ pluginId, pluginTitle, preview }: Props) {
  const usesBakedClipKeepalive =
    preview.kind === 'media' && preview.mediaType === 'video' && preview.loopHoldMs != null;
  const { ref: nearRef, inView } = useInView<HTMLDivElement>({ rootMargin: '320px' });
  const { ref: mediaRef, inView: mediaReady } = useInView<HTMLDivElement>({
    rootMargin: '720px',
    once: false,
  });
  const { ref: keepRef, inView: keep } = useInView<HTMLDivElement>({
    rootMargin: '1500px',
    once: false,
  });
  const { ref: visibleRef, inView: visible } = useInView<HTMLDivElement>({
    rootMargin: '0px',
    once: false,
  });
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      nearRef.current = node;
      mediaRef.current = node;
      keepRef.current = node;
      visibleRef.current = node;
    },
    [nearRef, mediaRef, keepRef, visibleRef],
  );

  return (
    <div
      ref={setRef}
      className={`plugins-home__preview plugins-home__preview--${preview.kind}`}
      data-preview-kind={preview.kind}
    >
      {preview.kind === 'media' ? (
        <MediaSurface
          preview={preview}
          pluginTitle={pluginTitle}
          inView={usesBakedClipKeepalive ? keep : mediaReady}
          visible={visible}
        />
      ) : preview.kind === 'html' ? (
        <HtmlSurface
          preview={preview}
          pluginId={pluginId}
          pluginTitle={pluginTitle}
          inView={inView}
        />
      ) : preview.kind === 'design' ? (
        <DesignSystemSurface preview={preview} />
      ) : (
        <TextSurface pluginTitle={pluginTitle} />
      )}
    </div>
  );
}
