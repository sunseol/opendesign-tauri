import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createChatRunService } from '../src/runs.js';

describe('chat run service shutdown', () => {
  it('retains structured error details on failed run status bodies', async () => {
    const runs = createRuns();
    const run = runs.create({ projectId: 'project-1', conversationId: 'conv-1' });

    const wait = runs.wait(run);
    runs.emit(run, 'error', {
      message: 'Agent stalled without emitting any new output for 1s.',
      error: {
        code: 'AGENT_EXECUTION_FAILED',
        message: 'Agent stalled without emitting any new output for 1s.',
        retryable: true,
      },
    });
    runs.finish(run, 'failed', 1, null);

    expect(runs.statusBody(run)).toMatchObject({
      status: 'failed',
      errorCode: 'AGENT_EXECUTION_FAILED',
      error: 'Agent stalled without emitting any new output for 1s.',
    });
    await expect(wait).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'AGENT_EXECUTION_FAILED',
      error: 'Agent stalled without emitting any new output for 1s.',
    });
  });

  it('includes resumable on failed run status and terminal SSE event', () => {
    const runs = createRuns();
    const run = runs.create({ projectId: 'project-1', conversationId: 'conv-1' });
    run.status = 'running';
    (run as any).resumable = true;

    runs.finish(run, 'failed', 1, null);

    expect(runs.statusBody(run)).toMatchObject({
      status: 'failed',
      resumable: true,
    });
    expect(run.events.at(-1)).toMatchObject({
      event: 'end',
      data: { status: 'failed', resumable: true },
    });
  });

  it('stores Browser Use availability on run status bodies', () => {
    const runs = createRuns();
    const run = runs.create({
      projectId: 'project-1',
      conversationId: 'conv-a',
      browserUse: {
        requested: true,
        available: false,
        reason: 'no-matching-browser-backend',
        diagnostics: {
          registryPath: '/tmp/codex-browser-use',
          registryExists: false,
          socketCount: 0,
          candidateCount: 0,
          staleCount: 0,
          currentSessionIdPresent: null,
          probeFailureCategory: 'registry-missing',
          staleThresholdMs: 600_000,
        },
      },
    });

    expect(runs.statusBody(run)).toMatchObject({
      browserUse: {
        requested: true,
        available: false,
        reason: 'no-matching-browser-backend',
        diagnostics: {
          registryPath: '/tmp/codex-browser-use',
          probeFailureCategory: 'registry-missing',
        },
      },
    });
  });

  it('destroys child stdio streams when a run reaches a terminal state', () => {
    const runs = createRuns();
    const child = new FakeChildProcess({ closeOn: 'SIGTERM', withStdio: true });
    const run = runs.create({ projectId: 'project-1', conversationId: 'conv-1' });
    run.status = 'running';
    (run as any).child = child;
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', () => undefined);
    child.stdin?.on('error', () => undefined);

    runs.finish(run, 'failed', 1, null);

    expect(child.stdout?.destroyed).toBe(true);
    expect(child.stderr?.destroyed).toBe(true);
    expect(child.stdin?.destroyed).toBe(true);
    expect(child.stdout?.listenerCount('data')).toBe(0);
    expect(child.stderr?.listenerCount('data')).toBe(0);
    expect(child.stdin?.listenerCount('error')).toBe(0);
  });

  it('filters active runs by conversation within the same project', () => {
    const runs = createRuns();
    const runA = runs.create({ projectId: 'project-1', conversationId: 'conv-a' });
    const runB = runs.create({ projectId: 'project-1', conversationId: 'conv-b' });
    runA.status = 'running';
    runB.status = 'running';

    expect(
      runs.list({ projectId: 'project-1', conversationId: 'conv-b', status: 'active' }),
    ).toEqual([runB]);
  });

  it('cancels active runs and terminates their child process during daemon shutdown', async () => {
    const runs = createRuns();
    const child = new FakeChildProcess({ closeOn: 'SIGTERM' });
    const run = runs.create({ projectId: 'project-1', conversationId: 'conv-1' });
    run.status = 'running';
    (run as any).child = child;

    const wait = runs.wait(run);
    await runs.shutdownActive({ graceMs: 10 });

    expect(child.signals).toEqual(['SIGTERM']);
    expect(run.status).toBe('canceled');
    expect(run.cancelRequested).toBe(true);
    expect(run.signal).toBe('SIGTERM');
    await expect(wait).resolves.toMatchObject({ status: 'canceled', signal: 'SIGTERM' });
    expect(run.events.at(-1)).toMatchObject({
      event: 'end',
      data: { status: 'canceled', signal: 'SIGTERM' },
    });
  });

  it('escalates to SIGKILL when a child ignores the shutdown SIGTERM grace window', async () => {
    const runs = createRuns();
    const child = new FakeChildProcess({ closeOn: 'SIGKILL' });
    const run = runs.create();
    run.status = 'running';
    (run as any).child = child;

    await runs.shutdownActive({ graceMs: 1 });

    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(run.status).toBe('canceled');
  });

  it('uses adapter abort before process signals for ACP-style runs', async () => {
    const runs = createRuns();
    const child = new FakeChildProcess({ closeOn: 'SIGTERM' });
    const abort = vi.fn();
    const run = runs.create();
    run.status = 'running';
    (run as any).child = child;
    (run as any).acpSession = { abort };

    await runs.shutdownActive({ graceMs: 10 });

    expect(abort).toHaveBeenCalledTimes(1);
    expect(child.signals).toEqual(['SIGTERM']);
    expect(run.status).toBe('canceled');
  });

  describe('cancel kill fallback', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('returns canceled status when canceling a run without a child', async () => {
      const runs = createRuns();
      const run = runs.create({ projectId: 'project-1', conversationId: 'conv-1' });
      run.status = 'running';

      const status = await runs.cancel(run);

      expect(status).toMatchObject({
        status: 'canceled',
        signal: 'SIGTERM',
        cancelRequested: true,
      });
      expect(run.status).toBe('canceled');
    });

    it('sends SIGTERM immediately and escalates to SIGKILL after the cancel grace window', async () => {
      vi.useFakeTimers();
      vi.stubEnv('OD_CHAT_RUN_CANCEL_GRACE_MS', '25');
      const runs = createRuns();
      const child = new FakeChildProcess({ closeOn: 'SIGKILL' });
      const run = runs.create();
      run.status = 'running';
      (run as any).child = child;

      const cancelPromise = runs.cancel(run);

      expect(run.cancelRequested).toBe(true);
      expect(child.signals).toEqual(['SIGTERM']);

      await vi.advanceTimersByTimeAsync(24);
      expect(child.signals).toEqual(['SIGTERM']);

      await vi.advanceTimersByTimeAsync(1);
      expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
      await expect(cancelPromise).resolves.toMatchObject({
        status: 'canceled',
        signal: 'SIGKILL',
      });
    });

    it('signals a process group before falling back to direct child signals', () => {
      if (process.platform === 'win32') return;
      const runs = createRuns();
      const child = new FakeChildProcess({ closeOn: 'SIGTERM' });
      const run = runs.create();
      run.status = 'running';
      (run as any).child = child;
      (run as any).processGroupId = 4242;
      const calls: Array<{ pid: number; signal: unknown }> = [];
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(((pid, signal) => {
        calls.push({ pid, signal });
        return true;
      }) as typeof process.kill);

      try {
        expect(runs.signalChild(run, 'SIGTERM')).toBe(true);
      } finally {
        killSpy.mockRestore();
      }

      expect(calls).toEqual([{ pid: -4242, signal: 'SIGTERM' }]);
      expect(child.signals).toEqual([]);
    });
  });
});

describe('chat run service stream replay', () => {
  it('replays the final event when a terminal-run cursor is already at the end', () => {
    const sendCalls: Array<{ event: string; data: unknown; id: number }> = [];
    const endCalls: number[] = [];
    const runs = createChatRunService({
      createSseResponse: () => ({
        send: vi.fn((event: string, data: unknown, id: number) => {
          sendCalls.push({ event, data, id });
          return true;
        }),
        end: vi.fn(() => endCalls.push(1)),
        cleanup: vi.fn(),
      }),
      createSseErrorPayload: (code: string, message: string) => ({ error: { code, message } }),
      shutdownGraceMs: 10,
      ttlMs: 60_000,
    });

    const run = runs.create({ projectId: 'p', conversationId: 'c' }) as any;
    runs.emit(run, 'stdout', { text: 'hello' });
    runs.finish(run, 'succeeded', 0, null);

    const finalEventId = run.events.at(-1).id;
    runs.stream(
      run,
      { get: () => null, query: { after: String(finalEventId) } } as never,
      { on: () => {} } as never,
    );

    expect(sendCalls.length).toBeGreaterThanOrEqual(1);
    expect(sendCalls.at(-1)?.event).toBe('end');
    expect(endCalls).toHaveLength(1);
  });

  it('does not duplicate events when the cursor is before the final event', () => {
    const sendCalls: Array<{ event: string; data: unknown; id: number }> = [];
    const runs = createChatRunService({
      createSseResponse: () => ({
        send: vi.fn((event: string, data: unknown, id: number) => {
          sendCalls.push({ event, data, id });
          return true;
        }),
        end: vi.fn(),
        cleanup: vi.fn(),
      }),
      createSseErrorPayload: (code: string, message: string) => ({ error: { code, message } }),
      shutdownGraceMs: 10,
      ttlMs: 60_000,
    });

    const run = runs.create() as any;
    runs.emit(run, 'stdout', { text: 'a' });
    runs.emit(run, 'stdout', { text: 'b' });
    runs.finish(run, 'succeeded', 0, null);

    const cursor = run.events[0].id;
    runs.stream(
      run,
      { get: () => null, query: { after: String(cursor) } } as never,
      { on: () => {} } as never,
    );

    expect(sendCalls.map((call) => call.id)).toEqual(
      run.events
        .filter((event: { id: number }) => event.id > cursor)
        .map((event: { id: number }) => event.id),
    );
  });
});

function createRuns() {
  return createChatRunService({
    createSseResponse: () => ({
      send: vi.fn(() => true),
      end: vi.fn(),
      cleanup: vi.fn(),
    }),
    createSseErrorPayload: (code: string, message: string) => ({ error: { code, message } }),
    shutdownGraceMs: 10,
    ttlMs: 60_000,
  });
}

class FakeChildProcess extends EventEmitter {
  exitCode: number | null = null;
  signalCode: string | null = null;
  killed = false;
  signals: string[] = [];
  stdout?: PassThrough;
  stderr?: PassThrough;
  stdin?: PassThrough;

  constructor(private readonly options: { closeOn: 'SIGTERM' | 'SIGKILL'; withStdio?: boolean }) {
    super();
    if (options.withStdio) {
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
      this.stdin = new PassThrough();
    }
  }

  kill(signal: string): boolean {
    this.killed = true;
    this.signals.push(signal);
    if (signal === this.options.closeOn) {
      this.signalCode = signal;
      queueMicrotask(() => {
        this.emit('exit', null, signal);
        this.emit('close', null, signal);
      });
    }
    return true;
  }
}
