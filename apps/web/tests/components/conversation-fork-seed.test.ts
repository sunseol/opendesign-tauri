import { describe, expect, it } from 'vitest';

import { conversationForkSeedMessages } from '../../src/components/conversationFork';
import type { ChatMessage } from '../../src/types';

describe('conversationForkSeedMessages', () => {
  it('keeps transcript messages through the fork point without run state', () => {
    const messages: ChatMessage[] = [
      { id: 'user-1', role: 'user', content: 'Start' },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'First answer',
        runId: 'run-1',
        runStatus: 'succeeded',
      },
      { id: 'user-2', role: 'user', content: 'Future question' },
    ];

    expect(conversationForkSeedMessages(messages, 'assistant-1')).toEqual([
      { id: 'user-1', role: 'user', content: 'Start' },
      { id: 'assistant-1', role: 'assistant', content: 'First answer' },
    ]);
  });

  it('returns an empty seed when the fork point is absent', () => {
    expect(conversationForkSeedMessages(
      [{ id: 'assistant-1', role: 'assistant', content: 'First answer' }],
      'missing',
    )).toEqual([]);
  });
});
