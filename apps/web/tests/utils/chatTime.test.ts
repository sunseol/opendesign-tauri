import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '../../src/types';
import { messageTime, shortTime } from '../../src/utils/chatTime';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('messageTime', () => {
  it('uses assistant startedAt before persisted createdAt', () => {
    const message: ChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Done',
      startedAt: 100,
      createdAt: 200,
      endedAt: 300,
    };

    expect(messageTime(message)).toBe(100);
  });

  it('keeps user createdAt as the primary timestamp', () => {
    const message: ChatMessage = {
      id: 'user-1',
      role: 'user',
      content: 'Build this',
      startedAt: 100,
      createdAt: 200,
    };

    expect(messageTime(message)).toBe(200);
  });
});

describe('shortTime', () => {
  it('formats a compact hour and minute label for inline chat timestamps', () => {
    const spy = vi
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockReturnValue('09:30 AM');

    expect(shortTime(Date.UTC(2026, 0, 1, 9, 30))).toBe('09:30 AM');
    expect(spy).toHaveBeenCalledWith(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  });
});
