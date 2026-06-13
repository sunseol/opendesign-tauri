import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamMessage } from '../../src/providers/anthropic';
import type { AppConfig, ChatMessage } from '../../src/types';

describe('Anthropic-compatible proxy context', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('passes project context so image attachments become native content blocks', async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: async () => pngBytes.buffer,
      })
      .mockResolvedValueOnce({
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
        apiProtocol: 'anthropic',
        apiKey: 'sk-ant-test',
        baseUrl: 'https://anthropic-compatible.example',
        model: 'vision-model',
      } as AppConfig,
      'system',
      [
        userMessage('describe', [
          { path: 'references/logo.png', name: 'logo.png', kind: 'image', size: 4 },
        ]),
      ],
      new AbortController().signal,
      {
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      { projectId: 'project-1' },
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/projects/project-1/raw/references/logo.png');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/proxy/anthropic/stream');
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'describe' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'iVBORw==',
              },
            },
          ],
        },
      ],
    });
  });
});

function userMessage(
  content: string,
  attachments: NonNullable<ChatMessage['attachments']>,
): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content,
    createdAt: 1,
    attachments,
  };
}
