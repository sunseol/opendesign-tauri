// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantMessage } from '../../src/components/AssistantMessage';
import type { ChatMessage } from '../../src/types';

afterEach(() => {
  cleanup();
});

function completedAssistantMessage(): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: 'Done.',
    runStatus: 'succeeded',
    startedAt: 1,
    endedAt: 2,
    events: [{ kind: 'text', text: 'Done.' }],
    producedFiles: [],
  };
}

describe('AssistantMessage fork action', () => {
  it('surfaces a fork action for a completed assistant turn', () => {
    const onForkConversation = vi.fn();

    render(
      <AssistantMessage
        message={completedAssistantMessage()}
        streaming={false}
        projectId="project-1"
        onForkConversation={onForkConversation}
      />,
    );

    const button = screen.getByTestId('assistant-fork-conversation');
    expect(button.textContent).toBe('Fork');

    fireEvent.click(button);

    expect(onForkConversation).toHaveBeenCalledTimes(1);
  });

  it('does not surface the fork action while the assistant turn is streaming', () => {
    render(
      <AssistantMessage
        message={{ ...completedAssistantMessage(), runStatus: 'running', endedAt: undefined }}
        streaming
        projectId="project-1"
        onForkConversation={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('assistant-fork-conversation')).toBeNull();
  });
});
