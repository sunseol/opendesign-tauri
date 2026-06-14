import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadTabs, saveTabs } from '../../src/state/projects';
import type { OpenTabsState } from '../../src/types';

describe('project workspace tab state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads browser workspace tabs from persisted tab state', async () => {
    const state: OpenTabsState = {
      tabs: ['index.html'],
      active: '__browser__:1',
      browserTabs: [
        {
          id: '__browser__:1',
          label: 'Reference',
          title: 'Example',
          url: 'https://example.com',
          iconUrl: 'https://example.com/favicon.ico',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const loaded = await loadTabs('project-1');

    expect(loaded.browserTabs?.[0]?.url).toBe('https://example.com');
  });

  it('saves browser workspace tabs with the regular tab payload', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const state: OpenTabsState = {
      tabs: ['index.html'],
      active: '__browser__:2',
      browserTabs: [
        {
          id: '__browser__:2',
          label: 'Inspiration',
          url: 'file:///Users/me/project/index.html',
        },
      ],
    };

    await saveTabs('project-1', state);

    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(JSON.parse(String(body))).toMatchObject({
      active: '__browser__:2',
      browserTabs: [{ id: '__browser__:2', label: 'Inspiration' }],
    });
  });
});
