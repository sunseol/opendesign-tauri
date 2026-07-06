// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileViewer } from '../../src/components/FileViewer';
import type { ProjectFile } from '../../src/types';

const DECK_RAW_URL = '/api/projects/project-1/raw/deck.html';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function deckFile(): ProjectFile {
  return {
    name: 'deck.html',
    path: 'deck.html',
    type: 'file',
    size: 1024,
    mtime: 1710000000,
    kind: 'html',
    mime: 'text/html',
    artifactManifest: {
      version: 1,
      kind: 'deck',
      title: 'Deck',
      entry: 'deck.html',
      renderer: 'deck-html',
      exports: ['html'],
    },
  };
}

function deckHtml(label: string): string {
  return `<html><body><section class="slide"><h1>${label}</h1></section><section class="slide"><p>two</p></section></body></html>`;
}

function fetchReturning(html: string) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (url.startsWith(DECK_RAW_URL)) return new Response(html, { status: 200 });
    if (url === '/api/projects/project-1/deployments') {
      return new Response(JSON.stringify({ deployments: [] }), { status: 200 });
    }
    return new Response('', { status: 404 });
  });
}

function deferredResponse(): { readonly promise: Promise<Response>; readonly resolve: (value: Response) => void } {
  let resolve: ((value: Response) => void) | null = null;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  if (resolve === null) throw new Error('Expected deferred response resolver');
  return { promise, resolve };
}

function srcDocFrame(): HTMLIFrameElement {
  const frame = screen.getByTestId('artifact-preview-frame');
  if (!(frame instanceof HTMLIFrameElement)) throw new Error('Expected artifact preview iframe');
  return frame;
}

function renderDeck(): void {
  render(
    <FileViewer
      projectId="project-1"
      projectKind="prototype"
      file={deckFile()}
      isDeck
    />,
  );
}

describe('FileViewer srcDoc reload', () => {
  it('clears stale srcdoc content while a reload refetch is pending', async () => {
    // Given: a deck preview already loaded through the srcDoc render path.
    vi.stubGlobal('fetch', fetchReturning(deckHtml('version-one')));
    renderDeck();
    await waitFor(() => {
      expect(srcDocFrame().srcdoc).toContain('version-one');
    });

    const pendingFetch = deferredResponse();
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.startsWith(DECK_RAW_URL)) return pendingFetch.promise;
      if (url === '/api/projects/project-1/deployments') {
        return new Response(JSON.stringify({ deployments: [] }), { status: 200 });
      }
      return new Response('', { status: 404 });
    }));

    // When: the user clicks the real Reload toolbar button.
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    // Then: stale srcDoc content is removed before the async refetch resolves.
    expect(srcDocFrame().srcdoc).not.toContain('version-one');

    await act(async () => {
      pendingFetch.resolve(new Response(deckHtml('version-two'), { status: 200 }));
      await pendingFetch.promise;
    });
    await waitFor(() => {
      expect(srcDocFrame().srcdoc).toContain('version-two');
    });
  });

  it('changes the srcdoc string on reload even when refetched bytes are identical', async () => {
    // Given: a deck preview whose next fetch returns byte-identical HTML.
    vi.stubGlobal('fetch', fetchReturning(deckHtml('same-content')));
    renderDeck();
    await waitFor(() => {
      expect(srcDocFrame().srcdoc).toContain('same-content');
    });
    const initialSrcDoc = srcDocFrame().srcdoc;

    // When: the user reloads the srcDoc preview.
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    // Then: the iframe receives a distinct srcDoc attribute anyway.
    await waitFor(() => {
      expect(srcDocFrame().srcdoc).toContain('data-od-reload-key="1"');
    });
    expect(srcDocFrame().srcdoc).not.toBe(initialSrcDoc);
  });
});
