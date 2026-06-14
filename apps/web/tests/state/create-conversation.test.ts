import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConversation } from '../../src/state/projects';

describe('createConversation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes fork seed options through to the daemon conversation endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({
        conversation: {
          id: 'conversation-fork',
          projectId: 'project-1',
          title: 'Forked',
          createdAt: 1,
          updatedAt: 1,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await createConversation('project-1', {
      forkAfterMessageId: 'assistant-1',
      seedFromConversationId: 'conversation-1',
      seedMessages: [{ content: 'local answer', id: 'assistant-1', role: 'assistant' }],
      title: 'Forked',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/conversations',
      expect.objectContaining({
        body: JSON.stringify({
          forkAfterMessageId: 'assistant-1',
          seedFromConversationId: 'conversation-1',
          seedMessages: [{ content: 'local answer', id: 'assistant-1', role: 'assistant' }],
          title: 'Forked',
        }),
        method: 'POST',
      }),
    );
  });
});
