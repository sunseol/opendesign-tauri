import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { registerMcpRoutes, type RegisterMcpRoutesDeps } from '../src/mcp-routes.js';
import { isLocalSameOrigin } from '../src/origin-validation.js';
import { setCodexRunner, type CodexRunner } from '../src/codex-cli.js';

interface Harness {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

const tempRoots: string[] = [];

afterEach(() => {
  setCodexRunner(null);
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Codex MCP install routes', () => {
  it('probes, installs, and removes through the codex CLI wrapper', async () => {
    const calls: string[][] = [];
    const runner: CodexRunner = {
      async run(args) {
        calls.push([...args]);
        return { exitCode: 0, stdout: 'ok\n', stderr: '' };
      },
    };
    setCodexRunner(runner);

    const harness = await startHarness();
    try {
      const status = await fetch(`${harness.baseUrl}/api/mcp/install/codex/status`);
      expect(status.status).toBe(200);
      expect(await status.json()).toEqual({ available: true, installed: true });

      const install = await fetch(`${harness.baseUrl}/api/mcp/install/codex`, { method: 'POST' });
      expect(install.status).toBe(200);
      expect(await install.json()).toEqual({ ok: true });

      const remove = await fetch(`${harness.baseUrl}/api/mcp/install/codex`, { method: 'DELETE' });
      expect(remove.status).toBe(200);
      expect(await remove.json()).toEqual({ ok: true });
    } finally {
      await harness.close();
    }

    expect(calls[0]).toEqual(['mcp', 'get', 'open-design']);
    expect(calls[1]).toContain('add');
    expect(calls[1]).toContain('open-design');
    expect(calls[1]).toContain('--env');
    expect(calls[1]).toContain('OD_DATA_DIR=' + tempRoots[0] + '/data');
    expect(calls[1]).toContain('--daemon-url');
    expect(calls[2]).toEqual(['mcp', 'remove', 'open-design']);
  });
});

async function startHarness(): Promise<Harness> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'od-mcp-codex-routes-'));
  tempRoots.push(root);
  const dataDir = path.join(root, 'data');
  const cliPath = path.join(root, 'od.mjs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(cliPath, '#!/usr/bin/env node\n', 'utf8');

  const app = express();
  const resolvedPortRef = { current: 0 };
  const daemonUrlRef = { current: '' };
  const paths = makePathDeps(root, dataDir, cliPath);
  const ctx: RegisterMcpRoutesDeps = {
    http: {
      createSseResponse: () => undefined,
      isLocalSameOrigin,
      requireLocalDaemonRequest: () => true,
      resolvedPortRef,
      sendApiError: (res: express.Response, status: number, code: string, message: string) =>
        res.status(status).json({ error: { code, message } }),
      sendLiveArtifactRouteError: () => undefined,
      sendMulterError: () => undefined,
    },
    paths,
    mcp: {
      pendingAuth: {
        put: () => undefined,
        consume: () => undefined,
      },
      daemonUrlRef,
    },
  };
  registerMcpRoutes(app, ctx);

  const server = await listen(app);
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('test server did not bind a TCP port');
  }
  resolvedPortRef.current = address.port;
  daemonUrlRef.current = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl: daemonUrlRef.current,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function makePathDeps(root: string, dataDir: string, cliPath: string): RegisterMcpRoutesDeps['paths'] {
  return {
    ARTIFACTS_DIR: path.join(root, 'artifacts'),
    BUNDLED_PETS_DIR: path.join(root, 'pets'),
    DESIGN_SYSTEMS_DIR: path.join(root, 'design-systems'),
    DESIGN_TEMPLATES_DIR: path.join(root, 'design-templates'),
    OD_BIN: cliPath,
    PROJECT_ROOT: root,
    PROJECTS_DIR: path.join(root, 'projects'),
    PROMPT_TEMPLATES_DIR: path.join(root, 'prompt-templates'),
    RUNTIME_DATA_DIR: dataDir,
    RUNTIME_DATA_DIR_CANONICAL: dataDir,
    SKILLS_DIR: path.join(root, 'skills'),
    USER_DESIGN_SYSTEMS_DIR: path.join(root, 'user-design-systems'),
    USER_DESIGN_TEMPLATES_DIR: path.join(root, 'user-design-templates'),
    USER_SKILLS_DIR: path.join(root, 'user-skills'),
  };
}

async function listen(app: express.Express): Promise<http.Server> {
  return await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
