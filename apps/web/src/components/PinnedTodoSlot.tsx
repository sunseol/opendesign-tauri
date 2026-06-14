import { useState, type MutableRefObject } from 'react';

import { latestTodoWriteInputForPinnedCard } from '../runtime/todos';
import type { ChatMessage } from '../types';
import { TodoCard } from './ToolCard';

type PinnedTodoSlotProps = {
  readonly containerRef?: MutableRefObject<HTMLDivElement | null>;
  readonly dismissedKey: string | null;
  readonly messages: readonly ChatMessage[];
  readonly onDismiss: (key: string | null) => void;
  readonly streaming: boolean;
};

export function PinnedTodoSlot({
  containerRef,
  dismissedKey,
  messages,
  onDismiss,
  streaming,
}: PinnedTodoSlotProps) {
  const [exiting, setExiting] = useState(false);
  const input = latestTodoWriteInputForPinnedCard(messages);
  if (input == null) return null;

  const snapshotKey = serializeSnapshot(input);
  if (snapshotKey === dismissedKey) return null;

  return (
    <div
      ref={containerRef}
      className={`chat-pinned-todo${exiting ? ' chat-pinned-todo-exit' : ''}`}
    >
      <TodoCard
        input={input}
        runStreaming={streaming}
        runSucceeded={!streaming}
        onDismiss={() => {
          if (exiting) return;
          setExiting(true);
          window.setTimeout(() => onDismiss(snapshotKey), 220);
        }}
      />
    </div>
  );
}

function serializeSnapshot(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
