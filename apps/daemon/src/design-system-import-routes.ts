import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

import {
  LocalDesignSystemImportError,
  importLocalDesignSystemProject,
} from './design-system-import.js';
import { importGitHubDesignSystemProject } from './design-system-github-import.js';
import { importShadcnDesignSystemProject } from './design-system-shadcn-import.js';
import type { RouteDeps } from './server-context.js';

type DesignSystemImportRoutesDeps = RouteDeps<'http' | 'paths' | 'resources'>;
type RequireLocalOrigin = (req: Request, res: Response) => boolean;
type CatalogDesignSystem = { id: string };

export function registerDesignSystemImportRoutes(
  app: Express,
  ctx: DesignSystemImportRoutesDeps,
  requireLocalOrigin: RequireLocalOrigin,
): void {
  app.post('/api/design-systems/import/local', async (req, res) => {
    if (!requireLocalOrigin(req, res)) return;
    try {
      const body = requestBody(req);
      const inputPath = localImportPath(body);
      if (!path.isAbsolute(inputPath)) {
        return ctx.http.sendApiError(res, 400, 'BAD_REQUEST', 'local project path must be absolute');
      }
      const sourceRoot = resolveLocalImportRoot(inputPath, ctx.paths.RUNTIME_DATA_DIR_CANONICAL, res, ctx);
      if (!sourceRoot) return;
      const result = await importWithCatalogReservation(ctx, async (reservedIds) =>
        importLocalDesignSystemProject(sourceRoot, ctx.paths.USER_DESIGN_SYSTEMS_DIR, {
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...commonImportOptions(body, reservedIds),
        }),
      );
      await sendImportedDesignSystem(ctx, res, result.id, result.dir, 'imported design system');
    } catch (err: unknown) {
      sendImportError(ctx, res, err instanceof Error ? err : new Error(String(err)));
    }
  });

  app.post('/api/design-systems/import/github', async (req, res) => {
    if (!requireLocalOrigin(req, res)) return;
    try {
      const body = requestBody(req);
      const githubUrl = typeof body.githubUrl === 'string'
        ? body.githubUrl
        : typeof body.url === 'string'
          ? body.url
          : '';
      const result = await importWithCatalogReservation(ctx, async (reservedIds) =>
        importGitHubDesignSystemProject(
          githubUrl,
          path.join(ctx.paths.PROJECT_ROOT, '.tmp'),
          ctx.paths.USER_DESIGN_SYSTEMS_DIR,
          {
            ...(typeof body.name === 'string' ? { name: body.name } : {}),
            ...(typeof body.branch === 'string' ? { branch: body.branch } : {}),
            ...commonImportOptions(body, reservedIds),
          },
        ),
      );
      await sendImportedDesignSystem(ctx, res, result.id, result.dir, 'imported GitHub design system');
    } catch (err: unknown) {
      sendImportError(ctx, res, err instanceof Error ? err : new Error(String(err)));
    }
  });

  app.post('/api/design-systems/import/shadcn', async (req, res) => {
    if (!requireLocalOrigin(req, res)) return;
    try {
      const body = requestBody(req);
      const reference = typeof body.reference === 'string'
        ? body.reference
        : typeof body.url === 'string'
          ? body.url
          : '';
      const result = await importWithCatalogReservation(ctx, async (reservedIds) =>
        importShadcnDesignSystemProject(
          reference,
          path.join(ctx.paths.PROJECT_ROOT, '.tmp'),
          ctx.paths.USER_DESIGN_SYSTEMS_DIR,
          {
            ...(typeof body.name === 'string' ? { name: body.name } : {}),
            ...commonImportOptions(body, reservedIds),
          },
        ),
      );
      await sendImportedDesignSystem(ctx, res, result.id, result.dir, 'imported shadcn design system');
    } catch (err: unknown) {
      sendImportError(ctx, res, err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function requestBody(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
}

function localImportPath(body: Record<string, unknown>): string {
  if (typeof body.baseDir === 'string') return body.baseDir;
  if (typeof body.path === 'string') return body.path;
  if (typeof body.localPath === 'string') return body.localPath;
  return '';
}

function resolveLocalImportRoot(
  inputPath: string,
  runtimeDataDirCanonical: string,
  res: Response,
  ctx: DesignSystemImportRoutesDeps,
): string | undefined {
  let sourceRoot: string;
  let sourceStats: fs.Stats;
  try {
    sourceRoot = fs.realpathSync.native(inputPath);
    sourceStats = fs.statSync(sourceRoot);
  } catch {
    ctx.http.sendApiError(res, 400, 'BAD_REQUEST', 'local project path was not found');
    return undefined;
  }
  if (!sourceStats.isDirectory()) {
    ctx.http.sendApiError(res, 400, 'BAD_REQUEST', 'local project path must be a directory');
    return undefined;
  }
  const sourceParent = path.dirname(sourceRoot);
  if (sourceRoot === sourceParent) {
    ctx.http.sendApiError(res, 400, 'BAD_REQUEST', 'local project path cannot be a filesystem root');
    return undefined;
  }
  if (isRuntimeDataPath(sourceRoot, runtimeDataDirCanonical)) {
    ctx.http.sendApiError(res, 400, 'BAD_REQUEST', 'cannot import Open Design runtime data');
    return undefined;
  }
  return sourceRoot;
}

function isRuntimeDataPath(sourceRoot: string, runtimeDataDirCanonical: string): boolean {
  try {
    const runtimeRoot = fs.realpathSync.native(runtimeDataDirCanonical);
    return sourceRoot === runtimeRoot || sourceRoot.startsWith(`${runtimeRoot}${path.sep}`);
  } catch {
    return false;
  }
}

async function importWithCatalogReservation<T>(
  ctx: DesignSystemImportRoutesDeps,
  run: (reservedIds: readonly string[]) => Promise<T>,
): Promise<T> {
  const before = await ctx.resources.listAllDesignSystems();
  return await run(designSystemDirIdsFromCatalog(before));
}

function commonImportOptions(body: Record<string, unknown>, reservedIds: readonly string[]) {
  const importMode = normalizeDesignSystemImportMode(body.importMode);
  const craftApplies = normalizeDesignSystemCraftApplies(body.craftApplies);
  return {
    ...(importMode ? { importMode } : {}),
    ...(craftApplies ? { craftApplies } : {}),
    reservedIds,
  };
}

async function sendImportedDesignSystem(
  ctx: DesignSystemImportRoutesDeps,
  res: Response,
  id: string,
  dir: string,
  missingMessage: string,
): Promise<void> {
  const systems = await ctx.resources.listAllDesignSystems();
  const designSystem = findUserDesignSystemInCatalog(systems, id);
  if (!designSystem) {
    ctx.http.sendApiError(res, 500, 'INTERNAL_ERROR', `${missingMessage} was not found in catalog: ${dir}`);
    return;
  }
  res.status(201).json({ designSystem });
}

export function findUserDesignSystemInCatalog<T extends CatalogDesignSystem>(
  systems: readonly T[],
  dirId: string,
): T | undefined {
  const catalogId = `user:${dirId}`;
  return systems.find((system) => system.id === catalogId || system.id === dirId);
}

export function designSystemDirIdsFromCatalog(systems: readonly CatalogDesignSystem[]): string[] {
  return systems.map((system) => (
    system.id.startsWith('user:') ? system.id.slice('user:'.length) : system.id
  ));
}

function sendImportError(ctx: DesignSystemImportRoutesDeps, res: Response, err: unknown): void {
  if (err instanceof LocalDesignSystemImportError) {
    ctx.http.sendApiError(res, err.code === 'BAD_REQUEST' ? 400 : 500, err.code, err.message);
    return;
  }
  ctx.http.sendApiError(res, 500, 'INTERNAL_ERROR', String(err));
}

function normalizeDesignSystemImportMode(value: unknown): 'normalized' | 'hybrid' | 'verbatim' | undefined {
  return value === 'normalized' || value === 'hybrid' || value === 'verbatim' ? value : undefined;
}

function normalizeDesignSystemCraftApplies(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const slug = entry.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
