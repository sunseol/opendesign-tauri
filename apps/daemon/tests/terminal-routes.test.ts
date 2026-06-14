import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerTerminalRoutes } from '../src/terminal-routes.js';
import {
  TerminalSessionManager,
  type TerminalProcess,
  type TerminalSpawnProcess,
} from '../src/terminal-sessions.js';

let server: http.Server | undefined;

class FakeTerminalProcess implements TerminalProcess {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  private readonly errorListeners: Array<(error: Error) => void> = [];
  private readonly exitListeners: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = [];

  onError(listener: (error: Error) => void): void {
    this.errorListeners.push(listener);
  }

  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void {
    this.exitListeners.push(listener);
  }

  kill(signal?: NodeJS.Signals | number): boolean {
    const normalizedSignal = typeof signal === 'string' ? signal : 'SIGTERM';
    this.emitExit(null, normalizedSignal);
    return true;
  }

  emitExit(code: number | null, signal: NodeJS.Signals | null): void {
    for (const listener of this.exitListeners) listener(code, signal);
  }

  emitError(error: Error): void {
    for (const listener of this.errorListeners) listener(error);
  }
}

describe('terminal routes', () => {
  let tempDir: string;
  let children: FakeTerminalProcess[];

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'od-terminal-routes-'));
    children = [];
  });

  afterEach(async () => {
    await closeServer();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates, lists, streams, writes to, resizes, and kills a project terminal session', async () => {
    const manager = new TerminalSessionManager({
      now: () => 1_800_000_000_000,
      randomId: () => 'term-1',
      spawnProcess: fakeSpawn(children),
    });
    const baseUrl = await startTerminalRouteServer(manager, tempDir);

    const created = await postJson(`${baseUrl}/api/projects/proj-1/terminals`, {
      cols: 100,
      rows: 30,
      shell: '/bin/test-shell',
    });
    expect(created).toMatchObject({
      terminal: {
        id: 'term-1',
        cwd: tempDir,
        cols: 100,
        rows: 30,
      },
    });
    expect(children).toHaveLength(1);

    const child = children[0];
    if (!child) throw new Error('expected spawned terminal child');
    const stdinWrites: string[] = [];
    child.stdin.on('data', (chunk: Buffer | string) => {
      stdinWrites.push(chunk.toString());
    });
    child.stdout.write('ready\n');

    const stream = await fetch(`${baseUrl}/api/projects/proj-1/terminals/term-1/stream`, {
      headers: { 'Last-Event-ID': '0' },
    });
    expect(stream.status).toBe(200);
    const streamBody = stream.body;
    if (!streamBody) throw new Error('expected terminal SSE body');
    const reader = streamBody.getReader();
    const firstChunk = await reader.read();
    if (!firstChunk.value) throw new Error('expected terminal SSE chunk');
    const sseText = new TextDecoder().decode(firstChunk.value);
    expect(sseText).toContain('event: data');
    expect(sseText).toContain('"ready\\n"');
    await reader.cancel();

    await postJson(`${baseUrl}/api/projects/proj-1/terminals/term-1/stdin`, { data: 'pwd\n' });
    expect(stdinWrites).toEqual(['pwd\n']);

    const resized = await postJson(`${baseUrl}/api/projects/proj-1/terminals/term-1/resize`, {
      cols: 120,
      rows: 40,
    });
    expect(resized).toMatchObject({ terminal: { cols: 120, rows: 40 } });

    const killed = await postJson(`${baseUrl}/api/projects/proj-1/terminals/term-1/kill`, {});
    expect(killed).toMatchObject({ terminal: { signal: 'SIGTERM', status: 'exited' } });

    const listed = await fetchJson(`${baseUrl}/api/projects/proj-1/terminals`);
    expect(listed).toMatchObject({ terminals: [{ id: 'term-1', status: 'exited' }] });
  });

  it('terminalizes a process error and replays the failure over SSE', async () => {
    const manager = new TerminalSessionManager({
      now: () => 1_800_000_000_000,
      randomId: () => 'term-1',
      spawnProcess: fakeSpawn(children),
    });
    const baseUrl = await startTerminalRouteServer(manager, tempDir);

    await postJson(`${baseUrl}/api/projects/proj-1/terminals`, {
      shell: '/bin/missing-shell',
    });
    const child = children[0];
    if (!child) throw new Error('expected spawned terminal child');
    child.emitError(new Error('missing shell'));

    const stream = await fetch(`${baseUrl}/api/projects/proj-1/terminals/term-1/stream`, {
      headers: { 'Last-Event-ID': '0' },
    });
    expect(stream.status).toBe(200);
    const sseText = await stream.text();
    expect(sseText).toContain('event: data');
    expect(sseText).toContain('terminal failed to start: missing shell');
    expect(sseText).toContain('event: exit');

    const listed = await fetchJson(`${baseUrl}/api/projects/proj-1/terminals`);
    expect(listed).toMatchObject({ terminals: [{ exitCode: 1, id: 'term-1', status: 'exited' }] });
  });
});

function fakeSpawn(children: FakeTerminalProcess[]): TerminalSpawnProcess {
  return () => {
    const child = new FakeTerminalProcess();
    children.push(child);
    return child;
  };
}

async function startTerminalRouteServer(manager: TerminalSessionManager, projectDir: string): Promise<string> {
  const app = express();
  app.use(express.json());
  registerTerminalRoutes(app, {
    http: { sendApiError },
    paths: { PROJECTS_DIR: path.dirname(projectDir) },
    projectStore: {
      getProject: (_db: unknown, projectId: string) =>
        projectId === 'proj-1' ? { id: projectId, metadata: { baseDir: projectDir } } : null,
    },
    terminals: manager,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      reject(new Error('server not started'));
      return;
    }
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('unexpected test server address');
  return `http://127.0.0.1:${address.port}`;
}

function sendApiError(
  res: express.Response,
  status: number,
  code: string,
  message: string,
): express.Response {
  return res.status(status).json({ error: { code, message } });
}

async function postJson(url: string, body: object): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${url} failed with ${response.status}: ${await response.text()}`);
  return response.json();
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}: ${await response.text()}`);
  return response.json();
}

async function closeServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error?: Error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
}
