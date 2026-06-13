// @ts-nocheck
import { randomUUID } from 'node:crypto';

export const TERMINAL_RUN_STATUSES = new Set(['succeeded', 'failed', 'canceled']);

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractErrorDetails(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const nested = payload.error && typeof payload.error === 'object' ? payload.error : {};
  return {
    error: readString(nested.message) ?? readString(payload.message),
    errorCode: readString(nested.code) ?? readString(payload.code),
  };
}

function destroyChildStdio(child) {
  if (!child) return;
  const destroyStream = (stream) => {
    if (!stream || stream.destroyed) return;
    try {
      stream.removeAllListeners();
    } catch {
      // Best-effort cleanup; terminal run handling must keep moving.
    }
    try {
      stream.destroy();
    } catch {
      // Same best-effort boundary as listener removal.
    }
  };
  destroyStream(child.stdout);
  destroyStream(child.stderr);
  destroyStream(child.stdin);
}

export function createChatRunService({
  createSseResponse,
  createSseErrorPayload,
  maxEvents = 2_000,
  ttlMs = 30 * 60 * 1000,
  shutdownGraceMs = 3_000,
}) {
  const runs = new Map();

  const create = (meta = {}) => {
    const now = Date.now();
    const run = {
      id: randomUUID(),
      projectId: typeof meta.projectId === 'string' && meta.projectId ? meta.projectId : null,
      conversationId: typeof meta.conversationId === 'string' && meta.conversationId ? meta.conversationId : null,
      assistantMessageId: typeof meta.assistantMessageId === 'string' && meta.assistantMessageId ? meta.assistantMessageId : null,
      clientRequestId: typeof meta.clientRequestId === 'string' && meta.clientRequestId ? meta.clientRequestId : null,
      agentId: typeof meta.agentId === 'string' && meta.agentId ? meta.agentId : null,
      // Plan §3.A1 / spec §11.5. The applied plugin snapshot id pins
      // every prompt fragment and tool gate to a frozen view so replay
      // is byte-equal across plugin upgrades. Runs are in-memory in
      // v1 — the id lives on the run object plus on the
      // `applied_plugin_snapshots` row (FK back via run_id).
      appliedPluginSnapshotId:
        typeof meta.appliedPluginSnapshotId === 'string' && meta.appliedPluginSnapshotId
          ? meta.appliedPluginSnapshotId
          : null,
      pluginId:
        typeof meta.pluginId === 'string' && meta.pluginId ? meta.pluginId : null,
      browserUse: meta.browserUse && typeof meta.browserUse === 'object' ? meta.browserUse : null,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      events: [],
      nextEventId: 1,
      clients: new Set(),
      waiters: new Set(),
      child: null,
      acpSession: null,
      childPid: null,
      processGroupId: null,
      childExitObservedAt: null,
      exitCode: null,
      signal: null,
      error: null,
      errorCode: null,
      cancelRequested: false,
    };
    runs.set(run.id, run);
    return run;
  };

  const get = (id) => runs.get(id) ?? null;

  const scheduleCleanup = (run) => {
    setTimeout(() => {
      if (TERMINAL_RUN_STATUSES.has(run.status)) runs.delete(run.id);
    }, ttlMs).unref?.();
  };

  const emit = (run, event, data) => {
    if (event === 'error') {
      const details = extractErrorDetails(data);
      if (details.error) run.error = details.error;
      if (details.errorCode) run.errorCode = details.errorCode;
    }
    const id = run.nextEventId++;
    const record = { id, event, data, timestamp: Date.now() };
    run.events.push(record);
    if (run.events.length > maxEvents) run.events.splice(0, run.events.length - maxEvents);
    run.updatedAt = Date.now();
    for (const sse of run.clients) sse.send(event, data, id);
    return record;
  };

  const childHasExited = (child) => !child || child.exitCode !== null || child.signalCode !== null;

  const recordChildExitObserved = (run) => {
    if (!run.childExitObservedAt) run.childExitObservedAt = Date.now();
  };

  const statusBody = (run) => ({
    id: run.id,
    projectId: run.projectId,
    conversationId: run.conversationId,
    assistantMessageId: run.assistantMessageId,
    agentId: run.agentId,
    appliedPluginSnapshotId: run.appliedPluginSnapshotId ?? null,
    pluginId: run.pluginId ?? null,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    cancelRequested: !!run.cancelRequested,
    childPid: typeof run.child?.pid === 'number' ? run.child.pid : run.childPid ?? null,
    processGroupId: run.processGroupId ?? null,
    childExited: childHasExited(run.child),
    childExitObservedAt: run.childExitObservedAt ?? null,
    exitCode: run.exitCode,
    signal: run.signal,
    error: run.error ?? null,
    errorCode: run.errorCode ?? null,
    resumable: run.resumable ?? false,
    ...(run.browserUse ? { browserUse: run.browserUse } : {}),
  });

  const finish = (run, status, code: number | null = null, signal: string | null = null) => {
    if (TERMINAL_RUN_STATUSES.has(run.status)) return;
    run.status = status;
    run.exitCode = code;
    run.signal = signal;
    run.updatedAt = Date.now();
    if (childHasExited(run.child)) recordChildExitObserved(run);
    emit(run, 'end', { code, signal, status, resumable: run.resumable ?? false });
    for (const sse of run.clients) sse.end();
    run.clients.clear();
    for (const waiter of run.waiters) waiter(statusBody(run));
    run.waiters.clear();
    destroyChildStdio(run.child);
    scheduleCleanup(run);
  };

  const fail = (run, code, message, init = {}) => {
    emit(run, 'error', createSseErrorPayload(code, message, init));
    finish(run, 'failed', 1, null);
  };

  const start = (run, starter) => {
    void starter(run).catch((err) => {
      fail(run, 'AGENT_EXECUTION_FAILED', err instanceof Error ? err.message : String(err));
    });
    return run;
  };

  const stream = (run, req, res) => {
    const sse = createSseResponse(res);
    const lastEventId = Number(req.get('Last-Event-ID') || req.query.after || 0);
    let sent = 0;
    for (const record of run.events) {
      if (!Number.isFinite(lastEventId) || record.id > lastEventId) {
        sse.send(record.event, record.data, record.id);
        sent++;
      }
    }
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      if (sent === 0 && run.events.length > 0) {
        const last = run.events[run.events.length - 1];
        sse.send(last.event, last.data, last.id);
      }
      sse.end();
      return;
    }
    run.clients.add(sse);
    res.on('close', () => {
      run.clients.delete(sse);
      sse.cleanup();
    });
  };

  const list = ({ projectId, conversationId, status } = {}) => Array.from(runs.values()).filter((run) => {
    if (typeof projectId === 'string' && projectId && run.projectId !== projectId) return false;
    if (typeof conversationId === 'string' && conversationId && run.conversationId !== conversationId) return false;
    if (status === 'active') return !TERMINAL_RUN_STATUSES.has(run.status);
    if (typeof status === 'string' && status) return run.status === status;
    return true;
  });

  const waitForChildExit = (child, timeoutMs) => {
    if (!child) return Promise.resolve(true);
    if (childHasExited(child)) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      const done = (exited) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.off?.('close', onClose);
        child.off?.('exit', onClose);
        resolve(exited);
      };
      const onClose = () => done(true);
      const timer = setTimeout(() => done(false), timeoutMs);
      timer.unref?.();
      child.once?.('close', onClose);
      child.once?.('exit', onClose);
    });
  };

  const forceWaitMs = () => {
    const raw = Number(process.env.OD_CHAT_RUN_CANCEL_FORCE_WAIT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : 500;
  };

  const killDirectChild = (child, signal) => {
    try {
      return child.kill(signal);
    } catch {
      return false;
    }
  };

  const killChild = (run, signal) => {
    if (!run.child || childHasExited(run.child)) return false;
    if (process.platform !== 'win32' && Number.isInteger(run.processGroupId)) {
      try {
        process.kill(-run.processGroupId, signal);
        return true;
      } catch {
        return killDirectChild(run.child, signal);
      }
    }
    return killDirectChild(run.child, signal);
  };

  const cancelGraceMs = () => {
    const raw = Number(process.env.OD_CHAT_RUN_CANCEL_GRACE_MS || process.env.OD_CHAT_RUN_SHUTDOWN_GRACE_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : 3000;
  };

  const finishCanceledFromChildState = (run, fallbackSignal = 'SIGTERM') => {
    if (childHasExited(run.child)) recordChildExitObserved(run);
    finish(
      run,
      'canceled',
      run.child?.exitCode ?? null,
      run.child?.signalCode ?? fallbackSignal,
    );
    return statusBody(run);
  };

  const cancel = async (run) => {
    if (TERMINAL_RUN_STATUSES.has(run.status)) return statusBody(run);
    run.cancelRequested = true;
    run.updatedAt = Date.now();
    if (!run.child) {
      finish(run, 'canceled', null, 'SIGTERM');
      return statusBody(run);
    }

    if (run.acpSession?.abort) {
      try {
        run.acpSession.abort();
      } catch {
        killChild(run, 'SIGTERM');
      }
      const graceMs = Number(process.env.PI_ABORT_GRACE_MS) || 3000;
      if (await waitForChildExit(run.child, graceMs)) {
        return finishCanceledFromChildState(run, 'SIGTERM');
      }
      killChild(run, 'SIGTERM');
      if (await waitForChildExit(run.child, graceMs)) {
        return finishCanceledFromChildState(run, 'SIGTERM');
      }
      killChild(run, 'SIGKILL');
      await waitForChildExit(run.child, forceWaitMs());
      return finishCanceledFromChildState(run, 'SIGKILL');
    }

    killChild(run, 'SIGTERM');
    if (await waitForChildExit(run.child, cancelGraceMs())) {
      return finishCanceledFromChildState(run, 'SIGTERM');
    }
    killChild(run, 'SIGKILL');
    await waitForChildExit(run.child, forceWaitMs());
    return finishCanceledFromChildState(run, 'SIGKILL');
  };

  const shutdownActive = async ({ graceMs = shutdownGraceMs } = {}) => {
    const activeRuns = Array.from(runs.values()).filter((run) => !TERMINAL_RUN_STATUSES.has(run.status));
    await Promise.all(activeRuns.map(async (run) => {
      run.cancelRequested = true;
      run.updatedAt = Date.now();
      if (run.acpSession?.abort) {
        try {
          run.acpSession.abort();
        } catch {
          // Process signals below are the shutdown fallback.
        }
      }
      killChild(run, 'SIGTERM');
      finish(run, 'canceled', null, 'SIGTERM');
      if (run.child && !(await waitForChildExit(run.child, graceMs))) {
        killChild(run, 'SIGKILL');
        await waitForChildExit(run.child, 500);
      }
    }));
  };

  const wait = (run) => {
    if (TERMINAL_RUN_STATUSES.has(run.status)) return Promise.resolve(statusBody(run));
    return new Promise((resolve) => run.waiters.add(resolve));
  };

  return {
    create,
    start,
    get,
    list,
    stream,
    cancel,
    shutdownActive,
    wait,
    emit,
    finish,
    fail,
    signalChild: killChild,
    statusBody,
    isTerminal(status) {
      return TERMINAL_RUN_STATUSES.has(status);
    },
  };
}
