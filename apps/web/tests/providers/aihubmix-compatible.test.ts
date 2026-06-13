import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamMessage } from '../../src/providers/anthropic';
import type { AppConfig, ChatMessage } from '../../src/types';

describe('AIHubMix BYOK provider routing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('routes AIHubMix API mode through the daemon AIHubMix proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: end\ndata: {}\n\n'));
          controller.close();
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await streamMessage(
      {
        apiProtocol: 'aihubmix',
        apiKey: 'sk-test',
        baseUrl: 'https://aihubmix.com/v1',
        model: 'gpt-5.5',
      } as AppConfig,
      'system',
      [userMessage('hello')],
      new AbortController().signal,
      {
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      { projectId: 'project-1' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/proxy/aihubmix/stream');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      baseUrl: 'https://aihubmix.com/v1',
      model: 'gpt-5.5',
      projectId: 'project-1',
      messages: [{ role: 'user', content: 'hello' }],
    });
  });
});

function userMessage(content: string): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content,
    createdAt: 1,
  };
}
