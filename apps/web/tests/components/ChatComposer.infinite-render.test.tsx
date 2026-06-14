// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer } from '../../src/components/ChatComposer';
import {
  composerText,
  flushComposerMount,
  pressEnter,
  typeAndSettle,
} from '../helpers/lexical-composer';

let fetchMock: ReturnType<typeof vi.fn>;

function renderComposer(overrides: Partial<ComponentProps<typeof ChatComposer>> = {}) {
  return render(
    <ChatComposer
      projectId="project-1"
      projectFiles={[]}
      streaming={false}
      onEnsureProject={async () => 'project-1'}
      onSend={vi.fn()}
      onStop={vi.fn()}
      skills={[]}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/mcp/servers') {
      return new Response(JSON.stringify({ servers: [], templates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/plugins') {
      return new Response(JSON.stringify({ plugins: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/skills') {
      return new Response(JSON.stringify({ skills: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  cleanup();
});

describe('ChatComposer infinite re-render regression (#2097)', () => {
  it('restores a saved draft for the active conversation', async () => {
    window.localStorage.setItem('od:chat-composer:draft:project-1:conv-1', 'draft before refresh');

    renderComposer({
      draftStorageKey: 'od:chat-composer:draft:project-1:conv-1',
    });

    await flushComposerMount();

    expect(composerText()).toBe('draft before refresh');
  });

  it('clears the saved draft after submitting it', async () => {
    const key = 'od:chat-composer:draft:project-1:conv-1';
    const onSend = vi.fn();
    renderComposer({
      draftStorageKey: key,
      onSend,
    });
    await flushComposerMount();
    await typeAndSettle('send then clear');

    await waitFor(() => expect(window.localStorage.getItem(key)).toBe('send then clear'));
    pressEnter({ meta: true });

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.localStorage.getItem(key)).toBeNull());
  });

  it('shows only stop while streaming with an empty composer', () => {
    renderComposer({ streaming: true });

    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByTestId('chat-send')).toBeNull();
  });

  it('keeps send available while streaming so the next prompt can queue', async () => {
    const onSend = vi.fn();
    const onStop = vi.fn();
    renderComposer({ streaming: true, onSend, onStop });

    await flushComposerMount();
    await typeAndSettle('change the font');

    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    fireEvent.click(screen.getByTestId('chat-send'));

    expect(onStop).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith('change the font', [], [], undefined);
  });

  it('does not loop while processing repeated plain-text editor updates', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderComposer();
      await flushComposerMount();

      for (const value of ['h', 'he', 'hel', 'hell', 'hello']) {
        await typeAndSettle(value);
      }

      const maxDepth = consoleError.mock.calls.find((args) =>
        args.some((a) => typeof a === 'string' && a.includes('Maximum update depth exceeded')),
      );
      expect(maxDepth).toBeUndefined();
    } finally {
      consoleError.mockRestore();
    }
  });
});
