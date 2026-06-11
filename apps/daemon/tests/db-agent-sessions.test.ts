import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeDatabase,
  getAgentSession,
  insertConversation,
  insertProject,
  openDatabase,
  upsertAgentSession,
} from '../src/db.js';

describe('agent session persistence', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'od-db-agent-sessions-'));
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function seedConversation(db: ReturnType<typeof openDatabase>) {
    const now = Date.now();
    insertProject(db, { id: 'proj-1', name: 'P', createdAt: now, updatedAt: now });
    insertConversation(db, {
      id: 'conv-1',
      projectId: 'proj-1',
      title: 'C',
      createdAt: now,
      updatedAt: now,
    });
  }

  it('upserts the resume session per conversation and agent', () => {
    const db = openDatabase(tempDir, { dataDir: tempDir });
    seedConversation(db);

    upsertAgentSession(db, {
      conversationId: 'conv-1',
      agentId: 'codebuddy',
      sessionId: 'session-1',
      stablePromptHash: 'hash-1',
      updatedAt: 100,
    });
    upsertAgentSession(db, {
      conversationId: 'conv-1',
      agentId: 'codebuddy',
      sessionId: 'session-2',
      stablePromptHash: 'hash-2',
      updatedAt: 200,
    });

    expect(getAgentSession(db, 'conv-1', 'codebuddy')).toEqual({
      conversationId: 'conv-1',
      agentId: 'codebuddy',
      sessionId: 'session-2',
      stablePromptHash: 'hash-2',
      updatedAt: 200,
    });
  });

  it('stores sessions for external run conversation ids', () => {
    const db = openDatabase(tempDir, { dataDir: tempDir });
    upsertAgentSession(db, {
      conversationId: 'external-conv-1',
      agentId: 'codebuddy',
      sessionId: 'session-1',
      updatedAt: 300,
    });

    expect(getAgentSession(db, 'external-conv-1', 'codebuddy')).toEqual({
      conversationId: 'external-conv-1',
      agentId: 'codebuddy',
      sessionId: 'session-1',
      stablePromptHash: null,
      updatedAt: 300,
    });
  });
});
