import type http from 'node:http';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { amrModelLoadingCache, AmrModelLoadingCache } from '../src/runtimes/amr-model-cache.js';
import { readAppConfig, writeAppConfig } from '../src/app-config.js';
import { startServer } from '../src/server.js';

const tempDirs: string[] = [];

afterEach(async () => {
  amrModelLoadingCache.resetForTests();
  await Promise.all(tempDirs.splice(0).map((dir) => rmSync(dir, { recursive: true, force: true })));
});

test('AmrModelLoadingCache returns preset models while warming the remote catalog', async () => {
  const cache = new AmrModelLoadingCache();
  let remoteCalls = 0;

  const first = await cache.get('amr-test', {
    fetchPreset: async () => [{ id: 'deepseek-v4-flash', label: 'deepseek-v4-flash' }],
    fetchRemote: async () => {
      remoteCalls += 1;
      return [{ id: 'gpt-5.4', label: 'gpt-5.4' }];
    },
  });

  expect(first).toMatchObject({
    source: 'preset',
    refreshing: true,
    models: [{ id: 'deepseek-v4-flash', label: 'deepseek-v4-flash' }],
  });
  await waitFor(() => remoteCalls === 1);

  const second = await cache.get('amr-test', {
    fetchPreset: async () => [],
    fetchRemote: async () => {
      remoteCalls += 1;
      return [{ id: 'unused', label: 'unused' }];
    },
  });

  expect(second).toMatchObject({
    source: 'remote',
    refreshing: false,
    models: [{ id: 'gpt-5.4', label: 'gpt-5.4' }],
  });
});

test('/api/amr/models serves preset models first and then the warmed remote catalog', async () => {
  const dataDir = process.env.OD_DATA_DIR;
  if (!dataDir) throw new Error('OD_DATA_DIR is required for daemon tests');
  const previousConfig = await readAppConfig(dataDir);
  const binDir = mkdtempSync(path.join(tmpdir(), 'od-amr-model-route-'));
  tempDirs.push(binDir);
  const vela = path.join(binDir, 'vela');
  writeFileSync(
    vela,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "vela 0.0.16"; exit 0; fi',
      'if [ "$1" = "model" ] && [ "$2" = "preset" ]; then',
      '  echo \'{"source":"preset","data":[{"id":"deepseek-v4-flash"},{"id":"glm-5.1"}]}\'',
      '  exit 0',
      'fi',
      'if [ "$1" = "model" ] && [ "$2" = "list" ]; then',
      '  echo \'{"source":"remote","data":[{"id":"gpt-5.4"},{"id":"deepseek-v4-flash"}]}\'',
      '  exit 0',
      'fi',
      'exit 1',
      '',
    ].join('\n'),
  );
  chmodSync(vela, 0o755);
  await writeAppConfig(dataDir, {
    ...previousConfig,
    agentCliEnv: {
      ...(previousConfig.agentCliEnv ?? {}),
      amr: {
        ...((previousConfig.agentCliEnv?.amr as Record<string, string>) ?? {}),
        VELA_BIN: vela,
      },
    },
  });

  let server: http.Server | null = null;
  try {
    const started = await startServer({ port: 0, returnServer: true }) as {
      url: string;
      server: http.Server;
    };
    server = started.server;

    const first = await getJson<{
      source: string;
      refreshing: boolean;
      models: Array<{ id: string }>;
    }>(`${started.url}/api/amr/models`);
    expect(first.status).toBe(200);
    expect(first.body.source).toBe('preset');
    expect(first.body.refreshing).toBe(true);
    expect(first.body.models.map((model) => model.id)).toEqual([
      'deepseek-v4-flash',
      'glm-5.1',
    ]);

    const warmed = await waitFor(async () => {
      const response = await getJson<{
        source: string;
        models: Array<{ id: string }>;
      }>(`${started.url}/api/amr/models`);
      return response.body.source === 'remote' ? response : null;
    });
    expect(warmed.body.models.map((model) => model.id)).toEqual([
      'deepseek-v4-flash',
      'gpt-5.4',
    ]);
  } finally {
    await writeAppConfig(dataDir, previousConfig as unknown as Record<string, unknown>);
    const closingServer = server;
    if (closingServer) {
      await new Promise<void>((resolve) => closingServer.close(() => resolve()));
    }
  }
});

async function getJson<T>(url: string): Promise<{ status: number; body: T }> {
  const resp = await fetch(url);
  return { status: resp.status, body: (await resp.json()) as T };
}

async function waitFor<T>(
  probe: () => T | null | false | Promise<T | null | false>,
  timeoutMs = 2_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await probe();
    if (result) return result;
    if (Date.now() >= deadline) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
