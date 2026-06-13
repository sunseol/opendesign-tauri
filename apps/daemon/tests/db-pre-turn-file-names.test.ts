import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeDatabase,
  getMessageTelemetryFinalizationState,
  insertConversation,
  insertProject,
  listMessages,
  openDatabase,
  upsertMessage,
} from '../src/db.js';

describe('preTurnFileNames persistence', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'od-db-pre-turn-'));
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
    return now;
  }

  it('round-trips preTurnFileNames through upsert and listMessages', () => {
    const db = openDatabase(tempDir, { dataDir: tempDir });
    const now = seedConversation(db);

    upsertMessage(db, 'conv-1', {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      runId: 'run-1',
      runStatus: 'running',
      startedAt: now,
      preTurnFileNames: ['existing.html', 'README.md'],
    });

    const reloaded = listMessages(db, 'conv-1');
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]!.preTurnFileNames).toEqual(['existing.html', 'README.md']);
  });

  it('preserves preTurnFileNames across an update upsert', () => {
    const db = openDatabase(tempDir, { dataDir: tempDir });
    const now = seedConversation(db);

    upsertMessage(db, 'conv-1', {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      runId: 'run-1',
      runStatus: 'running',
      startedAt: now,
      preTurnFileNames: ['existing.html'],
    });
    upsertMessage(db, 'conv-1', {
      id: 'assistant-1',
      role: 'assistant',
      content: 'streamed chunk',
      runId: 'run-1',
      runStatus: 'running',
      startedAt: now,
      preTurnFileNames: ['existing.html'],
    });

    const [msg] = listMessages(db, 'conv-1');
    expect(msg).toBeDefined();
    expect(msg!.preTurnFileNames).toEqual(['existing.html']);
  });

  it('returns undefined for legacy messages with no baseline', () => {
    const db = openDatabase(tempDir, { dataDir: tempDir });
    const now = seedConversation(db);

    upsertMessage(db, 'conv-1', {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      runStatus: 'running',
      startedAt: now,
    });

    const [msg] = listMessages(db, 'conv-1');
    expect(msg).toBeDefined();
    expect(msg!.preTurnFileNames).toBeUndefined();
  });

  it('records telemetry finalization once without moving it on later updates', () => {
    const db = openDatabase(tempDir, { dataDir: tempDir });
    const now = seedConversation(db);

    upsertMessage(db, 'conv-1', {
      id: 'assistant-1',
      role: 'assistant',
      content: 'final',
      runId: 'run-1',
      runStatus: 'failed',
      startedAt: now,
      endedAt: now + 1000,
      telemetryFinalized: true,
    });
    const first = getMessageTelemetryFinalizationState(db, 'assistant-1');
    upsertMessage(db, 'conv-1', {
      id: 'assistant-1',
      role: 'assistant',
      content: 'late retry write',
      runId: 'run-1',
      runStatus: 'failed',
      startedAt: now,
      endedAt: now + 2000,
      telemetryFinalized: true,
    });
    const second = getMessageTelemetryFinalizationState(db, 'assistant-1');

    expect(first.exists).toBe(true);
    expect(typeof first.finalizedAt).toBe('number');
    expect(second).toEqual(first);
  });
});
