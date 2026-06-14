import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('POST /api/projects/:id/conversations fork seeding', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { startServer } = await import('../src/server.js');
    const started = await startServer({ port: 0, returnServer: true });
    if (!isStartedServer(started)) throw new TypeError('expected startServer to return a server handle');
    baseUrl = started.url;
    server = started.server;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('copies source messages through the requested fork point', async () => {
    const projectId = `conversation-fork-${randomUUID()}`;
    await createProject(baseUrl, projectId);
    const sourceConversation = await createConversation(baseUrl, projectId, { title: 'Source' });
    await saveMessage(baseUrl, projectId, sourceConversation.id, 'user-1', {
      content: 'Make the header calmer.',
      role: 'user',
    });
    await saveMessage(baseUrl, projectId, sourceConversation.id, 'assistant-1', {
      content: 'The header is now calmer.',
      role: 'assistant',
      runId: 'run-1',
      runStatus: 'succeeded',
    });
    await saveMessage(baseUrl, projectId, sourceConversation.id, 'user-2', {
      content: 'Future follow-up should not be copied.',
      role: 'user',
    });
    const sourceMessages = await listMessages(baseUrl, projectId, sourceConversation.id);
    expect(sourceMessages.map((message) => message.content)).toEqual([
      'Make the header calmer.',
      'The header is now calmer.',
      'Future follow-up should not be copied.',
    ]);

    const forked = await createConversation(baseUrl, projectId, {
      forkAfterMessageId: 'assistant-1',
      seedFromConversationId: sourceConversation.id,
      title: 'Forked',
    });
    const forkedMessages = await listMessages(baseUrl, projectId, forked.id);

    expect(forkedMessages.map((message) => message.content)).toEqual([
      'Make the header calmer.',
      'The header is now calmer.',
    ]);
    expect(forkedMessages.map((message) => message.id)).not.toEqual(['user-1', 'assistant-1']);
    expect(forkedMessages[1]).not.toHaveProperty('runStatus');
  });

  it('uses client-provided seed messages when the source message is not persisted', async () => {
    const projectId = `conversation-fork-${randomUUID()}`;
    await createProject(baseUrl, projectId);

    const forked = await createConversation(baseUrl, projectId, {
      forkAfterMessageId: 'local-assistant',
      seedFromConversationId: 'missing-source',
      seedMessages: [
        { content: 'Local unsaved prompt.', id: 'local-user', role: 'user' },
        { content: 'Local unsaved answer.', id: 'local-assistant', role: 'assistant' },
      ],
      title: 'Local fork',
    });
    const forkedMessages = await listMessages(baseUrl, projectId, forked.id);

    expect(forkedMessages.map((message) => message.content)).toEqual([
      'Local unsaved prompt.',
      'Local unsaved answer.',
    ]);
    expect(forkedMessages.every((message) => message.id.startsWith('local-'))).toBe(false);
  });
});

async function createProject(baseUrl: string, projectId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: projectId, name: projectId }),
  });
  expect(response.status).toBe(200);
}

async function createConversation(
  baseUrl: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const response = await fetch(`${baseUrl}/api/projects/${projectId}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return { id: conversationIdFromPayload(await response.json()) };
}

async function saveMessage(
  baseUrl: string,
  projectId: string,
  conversationId: string,
  messageId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/projects/${projectId}/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
}

async function listMessages(
  baseUrl: string,
  projectId: string,
  conversationId: string,
): Promise<Array<{ content: string; id: string }>> {
  const response = await fetch(`${baseUrl}/api/projects/${projectId}/conversations/${conversationId}/messages`);
  expect(response.status).toBe(200);
  return listedMessagesFromPayload(await response.json());
}

interface StartedServer {
  readonly server: http.Server;
  readonly url: string;
}

interface ListedMessage {
  readonly content: string;
  readonly id: string;
}

function isStartedServer(value: unknown): value is StartedServer {
  return isRecord(value) && value.server instanceof http.Server && typeof value.url === 'string';
}

function conversationIdFromPayload(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.conversation) || typeof value.conversation.id !== 'string') {
    throw new TypeError('expected conversation response payload');
  }
  return value.conversation.id;
}

function listedMessagesFromPayload(value: unknown): ListedMessage[] {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw new TypeError('expected messages response payload');
  }
  const messages = value.messages.map(listedMessageFromUnknown);
  if (messages.some((message) => message === null)) {
    throw new TypeError('expected listed chat messages');
  }
  return messages.filter(isListedMessage);
}

function listedMessageFromUnknown(value: unknown): ListedMessage | null {
  if (!isRecord(value) || typeof value.content !== 'string' || typeof value.id !== 'string') return null;
  return { content: value.content, id: value.id };
}

function isListedMessage(value: ListedMessage | null): value is ListedMessage {
  return value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
