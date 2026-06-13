// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const FAILURE_KEY = 'open-design:gh-stars:last-failure';

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('GithubStarBadge', () => {
  it('backs off after an offline failure instead of retrying on every remount', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch;
    const { GithubStarBadge } = await import('../../src/components/GithubStarBadge');

    render(<GithubStarBadge />);

    await waitFor(() => expect(window.localStorage.getItem(FAILURE_KEY)).toBeTruthy());
    cleanup();

    render(<GithubStarBadge />);

    expect(screen.getByText('—')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('backs off when GitHub returns an offline response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } satisfies Partial<Response>) as typeof fetch;
    const { GithubStarBadge } = await import('../../src/components/GithubStarBadge');

    render(<GithubStarBadge />);

    await waitFor(() => expect(window.localStorage.getItem(FAILURE_KEY)).toBeTruthy());
    cleanup();

    render(<GithubStarBadge />);

    expect(screen.getByText('—')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not back off after effect cleanup aborts an in-flight request', async () => {
    const fetchCalls: AbortSignal[] = [];
    globalThis.fetch = vi.fn((_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      if (!(signal instanceof AbortSignal)) {
        throw new Error('expected fetch to receive an AbortSignal');
      }
      fetchCalls.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      });
    }) as typeof fetch;
    const { GithubStarBadge } = await import('../../src/components/GithubStarBadge');

    render(<GithubStarBadge />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    render(<GithubStarBadge />);

    expect(fetchCalls[0]?.aborted).toBe(true);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
  });
});
