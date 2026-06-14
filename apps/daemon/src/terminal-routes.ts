import type { Express, Request, Response } from 'express';
import path from 'node:path';
import type { PathDeps } from './server-context.js';
import { TerminalSessionManager, type BufferedTerminalEvent, type TerminalMutationResult } from './terminal-sessions.js';

type SendApiError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  extras?: Record<string, unknown>,
) => unknown;

interface ProjectStore {
  readonly getProject: (db: unknown, projectId: string) => unknown;
}

export interface RegisterTerminalRoutesDeps {
  readonly db?: unknown;
  readonly http: { readonly sendApiError: SendApiError };
  readonly paths: Pick<PathDeps, 'PROJECTS_DIR'>;
  readonly projectStore: ProjectStore;
  readonly terminals?: TerminalSessionManager;
}

interface ProjectContext {
  readonly cwd: string;
  readonly projectId: string;
}

export function registerTerminalRoutes(app: Express, ctx: RegisterTerminalRoutesDeps): void {
  const manager = ctx.terminals ?? new TerminalSessionManager();
  const { sendApiError } = ctx.http;

  app.get('/api/projects/:id/terminals', (req, res) => {
    const project = resolveProjectContext(req, ctx);
    if (!project) return sendApiError(res, 404, 'NOT_FOUND', 'project not found');
    res.json({ terminals: manager.list(project.projectId) });
  });

  app.post('/api/projects/:id/terminals', (req, res) => {
    const project = resolveProjectContext(req, ctx);
    if (!project) return sendApiError(res, 404, 'NOT_FOUND', 'project not found');
    const body = objectBody(req.body);
    try {
      const terminal = manager.create({
        cols: body.cols,
        cwd: project.cwd,
        projectId: project.projectId,
        rows: body.rows,
        shell: body.shell,
      });
      res.status(201).json({ terminal });
    } catch (error) {
      if (error instanceof Error) {
        return sendApiError(res, 500, 'TERMINAL_START_FAILED', error.message);
      }
      throw error;
    }
  });

  app.post('/api/projects/:id/terminals/:terminalId/stdin', (req, res) => {
    const project = resolveProjectContext(req, ctx);
    if (!project) return sendApiError(res, 404, 'NOT_FOUND', 'project not found');
    const body = objectBody(req.body);
    if (typeof body.data !== 'string') {
      return sendApiError(res, 400, 'BAD_REQUEST', 'data must be a string');
    }
    sendTerminalMutation(res, sendApiError, manager.write(project.projectId, req.params.terminalId, body.data));
  });

  app.post('/api/projects/:id/terminals/:terminalId/resize', (req, res) => {
    const project = resolveProjectContext(req, ctx);
    if (!project) return sendApiError(res, 404, 'NOT_FOUND', 'project not found');
    const body = objectBody(req.body);
    sendTerminalMutation(
      res,
      sendApiError,
      manager.resize(project.projectId, req.params.terminalId, body.cols, body.rows),
    );
  });

  app.post('/api/projects/:id/terminals/:terminalId/kill', (req, res) => {
    const project = resolveProjectContext(req, ctx);
    if (!project) return sendApiError(res, 404, 'NOT_FOUND', 'project not found');
    sendTerminalMutation(res, sendApiError, manager.kill(project.projectId, req.params.terminalId));
  });

  app.get('/api/projects/:id/terminals/:terminalId/stream', (req, res) => {
    const project = resolveProjectContext(req, ctx);
    if (!project) return sendApiError(res, 404, 'NOT_FOUND', 'project not found');
    const terminalId = req.params.terminalId;
    const session = manager.get(project.projectId, terminalId);
    if (!session) return sendApiError(res, 404, 'NOT_FOUND', 'terminal not found');

    const lastEventId = parseLastEventId(req.header('Last-Event-ID'));
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    for (const entry of manager.eventsAfter(project.projectId, terminalId, lastEventId)) {
      writeTerminalEvent(res, entry);
    }
    if (session.status === 'exited') {
      res.end();
      return;
    }
    const unsubscribe = manager.subscribe(project.projectId, terminalId, (entry) => {
      writeTerminalEvent(res, entry);
      if (entry.payload.event === 'exit') res.end();
    });
    if (!unsubscribe) {
      res.end();
      return;
    }
    req.on('close', unsubscribe);
  });
}

function sendTerminalMutation(
  res: Response,
  sendApiError: SendApiError,
  result: TerminalMutationResult,
): unknown {
  if (result.ok) return res.json({ terminal: result.terminal });
  if (result.reason === 'not_found') return sendApiError(res, 404, 'NOT_FOUND', 'terminal not found');
  if (result.reason === 'exited') return sendApiError(res, 410, 'GONE', 'terminal has exited');
  return sendApiError(res, 500, 'TERMINAL_WRITE_FAILED', result.message ?? 'terminal write failed');
}

function resolveProjectContext(req: Request, ctx: RegisterTerminalRoutesDeps): ProjectContext | null {
  const projectId = req.params.id;
  if (!isSafeProjectId(projectId)) return null;
  const project = ctx.projectStore.getProject(ctx.db ?? null, projectId);
  if (!isObjectRecord(project)) return null;
  return {
    cwd: projectBaseDir(project, ctx.paths.PROJECTS_DIR, projectId),
    projectId,
  };
}

function projectBaseDir(project: Record<string, unknown>, projectsDir: string, projectId: string): string {
  const metadata = project.metadata;
  if (isObjectRecord(metadata) && typeof metadata.baseDir === 'string' && path.isAbsolute(metadata.baseDir)) {
    return path.normalize(metadata.baseDir);
  }
  return path.join(projectsDir, projectId);
}

function objectBody(value: unknown): Record<string, unknown> {
  if (isObjectRecord(value)) return value;
  return {};
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeProjectId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 128) return false;
  if (/^\.+$/u.test(value)) return false;
  return /^[A-Za-z0-9._-]+$/u.test(value);
}

function parseLastEventId(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function writeTerminalEvent(res: Response, entry: BufferedTerminalEvent): void {
  if (res.writableEnded) return;
  res.write(`id: ${entry.id}\n`);
  res.write(`event: ${entry.payload.event}\n`);
  res.write(`data: ${JSON.stringify(entry.payload.data)}\n\n`);
}
