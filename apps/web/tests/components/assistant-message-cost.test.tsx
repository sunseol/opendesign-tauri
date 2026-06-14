// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AssistantMessage } from '../../src/components/AssistantMessage';
import type { AgentEvent, ChatMessage } from '../../src/types';

afterEach(() => cleanup());

function messageWithCost(id: string, costUsd: number): ChatMessage {
  const usage: AgentEvent = {
    kind: 'usage',
    outputTokens: 1439,
    durationMs: 32_000,
    costUsd,
  };

  return {
    id,
    role: 'assistant',
    content: 'Done',
    startedAt: 1_000,
    runStatus: 'succeeded',
    events: [usage],
  };
}

describe('AssistantMessage usage cost display', () => {
  it('hides zero cost because unavailable billing data should not look authoritative', () => {
    render(
      <AssistantMessage message={messageWithCost('assistant-zero-cost', 0)} streaming={false} projectId="project-1" isLast />,
    );

    expect(screen.getByText(/1439 out/)).toBeTruthy();
    expect(screen.queryByText(/\$0\.0000/)).toBeNull();
  });

  it('hides costs that round to zero at the current display precision', () => {
    render(
      <AssistantMessage message={messageWithCost('assistant-rounded-zero-cost', 0.00001)} streaming={false} projectId="project-1" isLast />,
    );

    expect(screen.getByText(/1439 out/)).toBeTruthy();
    expect(screen.queryByText(/\$0\.0000/)).toBeNull();
  });

  it('shows positive usage cost when billing data is present', () => {
    render(
      <AssistantMessage message={messageWithCost('assistant-positive-cost', 0.0123)} streaming={false} projectId="project-1" isLast />,
    );

    expect(screen.getByText(/\$0\.0123/)).toBeTruthy();
  });
});
