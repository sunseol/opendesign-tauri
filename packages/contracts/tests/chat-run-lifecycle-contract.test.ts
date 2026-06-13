import { describe, expect, it } from 'vitest';
import {
  CHAT_RUN_STATUSES,
  type ChatRunStatus,
  ChatRunCancelResponse,
  ChatRunStatusResponse,
} from '../src/api/chat';

describe('chat run lifecycle contract', () => {
  it('exports the canonical run status literals', () => {
    expect(CHAT_RUN_STATUSES).toEqual(['queued', 'running', 'succeeded', 'failed', 'canceled']);

    const status: ChatRunStatus = CHAT_RUN_STATUSES[0];
    expect(status).toBe('queued');
  });

  it('accepts daemon process lifecycle metadata on run status responses', () => {
    const status = {
      id: 'run-1',
      projectId: 'proj-1',
      conversationId: 'conv-1',
      assistantMessageId: 'msg-1',
      agentId: 'claude',
      status: 'running',
      createdAt: 1,
      updatedAt: 2,
      cancelRequested: true,
      childPid: 1234,
      processGroupId: 1234,
      childExited: false,
      childExitObservedAt: null,
    } satisfies ChatRunStatusResponse;

    expect(status.cancelRequested).toBe(true);
    expect(status.childPid).toBe(1234);
    expect(status.processGroupId).toBe(1234);
    expect(status.childExited).toBe(false);
    expect(status.childExitObservedAt).toBeNull();
  });

  it('allows cancel responses to include the latest run snapshot', () => {
    const response = {
      ok: true,
      run: {
        id: 'run-1',
        projectId: 'proj-1',
        conversationId: 'conv-1',
        assistantMessageId: 'msg-1',
        agentId: 'claude',
        status: 'canceled',
        createdAt: 1,
        updatedAt: 3,
        cancelRequested: true,
        childPid: null,
        processGroupId: null,
        childExited: true,
        childExitObservedAt: 3,
      },
    } satisfies ChatRunCancelResponse;

    expect(response.run?.status).toBe('canceled');
    expect(response.run?.childExited).toBe(true);
  });
});
