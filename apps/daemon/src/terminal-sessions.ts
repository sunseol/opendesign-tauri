import type {
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSession,
  TerminalSseEvent,
} from '@open-design/contracts';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MIN_COLS = 20;
const MAX_COLS = 400;
const MIN_ROWS = 5;
const MAX_ROWS = 120;
const MAX_BUFFERED_EVENTS = 500;

export interface TerminalProcess {
  readonly stdin: Pick<NodeJS.WritableStream, 'write'>;
  readonly stdout: Pick<NodeJS.ReadableStream, 'on'>;
  readonly stderr: Pick<NodeJS.ReadableStream, 'on'>;
  onError(listener: (error: Error) => void): void;
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  kill(signal?: NodeJS.Signals | number): boolean;
}

export interface TerminalSpawnInput {
  readonly command: string;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

export type TerminalSpawnProcess = (input: TerminalSpawnInput) => TerminalProcess;

export interface TerminalSessionManagerOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly now?: () => number;
  readonly platform?: NodeJS.Platform;
  readonly randomId?: () => string;
  readonly spawnProcess?: TerminalSpawnProcess;
}

export interface CreateTerminalSessionInput {
  readonly cols?: unknown;
  readonly cwd: string;
  readonly projectId: string;
  readonly rows?: unknown;
  readonly shell?: unknown;
}

export type TerminalMutationResult =
  | { readonly ok: true; readonly terminal: TerminalSession }
  | { readonly ok: false; readonly message?: string; readonly reason: 'exited' | 'not_found' | 'write_failed' };

export interface BufferedTerminalEvent {
  readonly id: number;
  readonly payload: TerminalSseEvent;
}

type TerminalSubscriber = (entry: BufferedTerminalEvent) => void;

interface TerminalRecord {
  buffer: BufferedTerminalEvent[];
  child: TerminalProcess;
  nextEventId: number;
  session: TerminalSession;
  subscribers: Set<TerminalSubscriber>;
}

export class TerminalSessionManager {
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => number;
  private readonly platform: NodeJS.Platform;
  private readonly randomId: () => string;
  private readonly records = new Map<string, TerminalRecord>();
  private readonly spawnProcess: TerminalSpawnProcess;

  constructor(options: TerminalSessionManagerOptions = {}) {
    this.env = options.env ?? process.env;
    this.now = options.now ?? Date.now;
    this.platform = options.platform ?? process.platform;
    this.randomId = options.randomId ?? randomUUID;
    this.spawnProcess = options.spawnProcess ?? defaultSpawnProcess;
  }

  create(input: CreateTerminalSessionInput): TerminalSession {
    const now = this.now();
    const shell = normalizeShell(input.shell, this.platform, this.env);
    const session: TerminalSession = {
      id: this.randomId(),
      projectId: input.projectId,
      cwd: input.cwd,
      shell,
      cols: normalizeDimension(input.cols, DEFAULT_COLS, MIN_COLS, MAX_COLS),
      rows: normalizeDimension(input.rows, DEFAULT_ROWS, MIN_ROWS, MAX_ROWS),
      status: 'running',
      createdAt: now,
      updatedAt: now,
      exitCode: null,
      signal: null,
    };
    const record: TerminalRecord = {
      buffer: [],
      child: this.spawnProcess({ command: shell, cwd: input.cwd, env: this.env }),
      nextEventId: 1,
      session,
      subscribers: new Set(),
    };
    this.records.set(session.id, record);
    record.child.stdout.on('data', (chunk: Buffer | string) => {
      this.emitData(record, { data: chunk.toString() });
    });
    record.child.stderr.on('data', (chunk: Buffer | string) => {
      this.emitData(record, { data: chunk.toString() });
    });
    record.child.onError((error) => {
      if (record.session.status === 'exited') return;
      this.emitData(record, { data: `terminal failed to start: ${error.message}\n` });
      record.session = {
        ...record.session,
        status: 'exited',
        updatedAt: this.now(),
        exitCode: 1,
        signal: null,
      };
      this.emitExit(record, { code: 1, signal: null });
    });
    record.child.onExit((code, signal) => {
      if (record.session.status === 'exited') return;
      record.session = {
        ...record.session,
        status: 'exited',
        updatedAt: this.now(),
        exitCode: code,
        signal,
      };
      this.emitExit(record, { code, signal });
    });
    return record.session;
  }

  list(projectId: string): TerminalSession[] {
    return [...this.records.values()]
      .filter((record) => record.session.projectId === projectId)
      .map((record) => record.session)
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  get(projectId: string, terminalId: string): TerminalSession | null {
    const record = this.find(projectId, terminalId);
    return record?.session ?? null;
  }

  write(projectId: string, terminalId: string, data: string): TerminalMutationResult {
    const record = this.find(projectId, terminalId);
    if (!record) return { ok: false, reason: 'not_found' };
    if (record.session.status === 'exited') return { ok: false, reason: 'exited' };
    try {
      record.child.stdin.write(data);
    } catch (error) {
      if (error instanceof Error) return { ok: false, message: error.message, reason: 'write_failed' };
      throw error;
    }
    record.session = { ...record.session, updatedAt: this.now() };
    return { ok: true, terminal: record.session };
  }

  resize(projectId: string, terminalId: string, cols: unknown, rows: unknown): TerminalMutationResult {
    const record = this.find(projectId, terminalId);
    if (!record) return { ok: false, reason: 'not_found' };
    record.session = {
      ...record.session,
      cols: normalizeDimension(cols, record.session.cols, MIN_COLS, MAX_COLS),
      rows: normalizeDimension(rows, record.session.rows, MIN_ROWS, MAX_ROWS),
      updatedAt: this.now(),
    };
    return { ok: true, terminal: record.session };
  }

  kill(projectId: string, terminalId: string): TerminalMutationResult {
    const record = this.find(projectId, terminalId);
    if (!record) return { ok: false, reason: 'not_found' };
    if (record.session.status === 'running') record.child.kill('SIGTERM');
    return { ok: true, terminal: record.session };
  }

  eventsAfter(projectId: string, terminalId: string, lastEventId: number): BufferedTerminalEvent[] {
    const record = this.find(projectId, terminalId);
    if (!record) return [];
    return record.buffer.filter((entry) => entry.id > lastEventId);
  }

  subscribe(projectId: string, terminalId: string, subscriber: TerminalSubscriber): (() => void) | null {
    const record = this.find(projectId, terminalId);
    if (!record) return null;
    record.subscribers.add(subscriber);
    return () => {
      record.subscribers.delete(subscriber);
    };
  }

  private find(projectId: string, terminalId: string): TerminalRecord | null {
    const record = this.records.get(terminalId);
    if (!record || record.session.projectId !== projectId) return null;
    return record;
  }

  private emitData(record: TerminalRecord, data: TerminalDataEvent): void {
    this.emit(record, { event: 'data', data });
  }

  private emitExit(record: TerminalRecord, data: TerminalExitEvent): void {
    this.emit(record, { event: 'exit', data });
  }

  private emit(record: TerminalRecord, payload: TerminalSseEvent): void {
    const entry = { id: record.nextEventId, payload };
    record.nextEventId += 1;
    record.buffer.push(entry);
    if (record.buffer.length > MAX_BUFFERED_EVENTS) record.buffer.shift();
    for (const subscriber of record.subscribers) subscriber(entry);
  }
}

function defaultSpawnProcess(input: TerminalSpawnInput): TerminalProcess {
  const child = spawn(input.command, [], {
    cwd: input.cwd,
    env: input.env,
    stdio: 'pipe',
  });
  return {
    stdin: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr,
    kill: (signal?: NodeJS.Signals | number) => child.kill(signal),
    onError: (listener: (error: Error) => void) => {
      child.on('error', listener);
    },
    onExit: (listener: (code: number | null, signal: NodeJS.Signals | null) => void) => {
      child.on('exit', listener);
    },
  };
}

function normalizeDimension(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function normalizeShell(value: unknown, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (platform === 'win32') return env.ComSpec || 'powershell.exe';
  return env.SHELL || defaultPosixShell();
}

function defaultPosixShell(): string {
  const userInfo = os.userInfo();
  return userInfo.shell || '/bin/sh';
}
