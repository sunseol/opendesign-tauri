import type http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

describe('POST /api/import/folder sandbox allowed roots', () => {
  let server: http.Server;
  let baseUrl: string;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      readonly url: string;
      readonly server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function makeFolder(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'od-import-'));
    tempDirs.push(dir);
    return dir;
  }

  async function importFolder(body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/import/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function createProject(): Promise<string> {
    const id = `sandbox-import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resp = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: id }),
    });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { readonly project: { readonly id: string } };
    return body.project.id;
  }

  async function withSandboxImportEnv<T>(
    roots: readonly string[],
    run: () => T | Promise<T>,
  ): Promise<T> {
    const previousSandboxMode = process.env.OD_SANDBOX_MODE;
    const previousAllowedRoots = process.env.OD_SANDBOX_IMPORT_ALLOWED_ROOTS;
    process.env.OD_SANDBOX_MODE = '1';
    process.env.OD_SANDBOX_IMPORT_ALLOWED_ROOTS = roots.join(path.delimiter);
    try {
      return await run();
    } finally {
      if (previousSandboxMode === undefined) {
        delete process.env.OD_SANDBOX_MODE;
      } else {
        process.env.OD_SANDBOX_MODE = previousSandboxMode;
      }
      if (previousAllowedRoots === undefined) {
        delete process.env.OD_SANDBOX_IMPORT_ALLOWED_ROOTS;
      } else {
        process.env.OD_SANDBOX_IMPORT_ALLOWED_ROOTS = previousAllowedRoots;
      }
    }
  }

  it('allows folder imports in sandbox mode when baseDir is under an allowed root', async () => {
    const allowedRoot = makeFolder();
    const folder = path.join(allowedRoot, 'job-clone');
    await mkdir(folder);
    await writeFile(path.join(folder, 'index.html'), '<!doctype html>');

    await withSandboxImportEnv([allowedRoot], async () => {
      const resp = await importFolder({ baseDir: folder });

      expect(resp.status).toBe(200);
      const body = (await resp.json()) as {
        readonly project: {
          readonly id: string;
          readonly metadata?: {
            readonly baseDir?: string;
            readonly importedFrom?: string;
          };
        };
        readonly entryFile: string | null;
      };
      expect(body.project.metadata?.baseDir).toBe(await realpath(folder));
      expect(body.project.metadata?.importedFrom).toBe('folder');
      expect(body.entryFile).toBe('index.html');

      const filesResp = await fetch(`${baseUrl}/api/projects/${body.project.id}/files`);
      expect(filesResp.status).toBe(200);
      const filesBody = (await filesResp.json()) as {
        readonly files: readonly { readonly name: string }[];
      };
      expect(filesBody.files.map((file) => file.name)).toContain('index.html');
    });
  });

  it('allows replacing a project working directory under an allowed sandbox root', async () => {
    const projectId = await createProject();
    const allowedRoot = makeFolder();
    const folder = path.join(allowedRoot, 'replacement');
    await mkdir(folder);
    await writeFile(path.join(folder, 'index.html'), '<!doctype html>');

    await withSandboxImportEnv([allowedRoot], async () => {
      const resp = await fetch(`${baseUrl}/api/projects/${projectId}/working-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDir: folder }),
      });

      expect(resp.status).toBe(200);
      const body = (await resp.json()) as {
        readonly baseDir: string;
        readonly entryFile: string | null;
        readonly project: { readonly metadata?: { readonly baseDir?: string } };
      };
      const expectedBaseDir = await realpath(folder);
      expect(body.baseDir).toBe(expectedBaseDir);
      expect(body.project.metadata?.baseDir).toBe(expectedBaseDir);
      expect(body.entryFile).toBe('index.html');
    });
  });

  it('rejects sandbox folder imports outside the allowed roots', async () => {
    const allowedRoot = makeFolder();
    const folder = makeFolder();
    await writeFile(path.join(folder, 'index.html'), '<!doctype html>');

    await withSandboxImportEnv([allowedRoot], async () => {
      const resp = await importFolder({ baseDir: folder });

      expect(resp.status).toBe(400);
      const body = (await resp.json()) as { readonly error?: { readonly message?: string } };
      expect(body.error?.message).toMatch(/OD_SANDBOX_IMPORT_ALLOWED_ROOTS/i);
    });
  });

  it('rejects relative sandbox import allowed roots', async () => {
    const folder = makeFolder();
    await writeFile(path.join(folder, 'index.html'), '<!doctype html>');

    await withSandboxImportEnv(['tmp'], async () => {
      const resp = await importFolder({ baseDir: folder });

      expect(resp.status).toBe(400);
      const body = (await resp.json()) as { readonly error?: { readonly message?: string } };
      expect(body.error?.message).toMatch(/OD_SANDBOX_IMPORT_ALLOWED_ROOTS.*absolute/i);
    });
  });
});
