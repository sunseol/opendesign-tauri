import type http from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readAppConfig, writeAppConfig, type AppConfigPrefs } from '../../src/app-config.js';
import { startServer } from '../../src/server.js';

interface StartedServer {
  url: string;
  server: http.Server;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE_VELA = path.resolve(HERE, '..', 'fixtures', 'fake-vela.mjs');

let baseUrl: string;
let server: http.Server;
let originalHome: string | undefined;
let tmpHome: string;
let previousConfig: AppConfigPrefs;

beforeAll(async () => {
  const started = (await startServer({ port: 0, returnServer: true })) as StartedServer;
  baseUrl = started.url;
  server = started.server;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(async () => {
  const dataDir = process.env.OD_DATA_DIR as string;
  previousConfig = await readAppConfig(dataDir);
  await writeAppConfig(dataDir, {
    ...previousConfig,
    agentCliEnv: {
      ...(previousConfig.agentCliEnv ?? {}),
      amr: {
        ...((previousConfig.agentCliEnv?.amr as Record<string, string>) ?? {}),
        VELA_BIN: FAKE_VELA,
      },
    },
  });
  originalHome = process.env.HOME;
  tmpHome = mkdtempSync(path.join(tmpdir(), 'od-vela-chat-'));
  process.env.HOME = tmpHome;
  process.env.OPEN_DESIGN_AMR_PROFILE = 'local';
});

afterEach(async () => {
  const dataDir = process.env.OD_DATA_DIR as string;
  await writeAppConfig(dataDir, previousConfig as unknown as Record<string, unknown>);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  delete process.env.OPEN_DESIGN_AMR_PROFILE;
  delete process.env.FAKE_VELA_PROMPT_ERROR;
  rmSync(tmpHome, { recursive: true, force: true });
});

describe('/api/chat AMR account failures', () => {
  it('fails before spawning AMR when the active profile is logged out', async () => {
    const body = await postChatAndReadSseText({
      agentId: 'amr',
      message: 'hello',
      model: 'deepseek-v4-flash',
    });

    expect(body).toContain('AMR_AUTH_REQUIRED');
    expect(body).toContain('amr_account');
    expect(body).toContain('relogin');
    expect(body).toContain('"status":"failed"');
  });

  it('maps AMR ACP balance errors to recharge guidance', async () => {
    seedLogin('local');
    process.env.FAKE_VELA_PROMPT_ERROR = 'insufficient wallet balance for this model';

    const body = await postChatAndReadSseText({
      agentId: 'amr',
      message: 'hello',
      model: 'deepseek-v4-flash',
    });

    expect(body).toContain('AMR_INSUFFICIENT_BALANCE');
    expect(body).toContain('amr_account');
    expect(body).toContain('recharge');
    expect(body).toContain('https://open-design.ai/amr/wallet');
    expect(body).toContain('"status":"failed"');
  });
});

function seedLogin(profile: string): void {
  const file = path.join(tmpHome, '.amr', 'config.json');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      {
        profiles: {
          [profile]: {
            runtimeKey: 'rt-seeded',
            controlKey: 'ck-seeded',
            user: { id: 'user', email: 'amr@example.com' },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  expect(readFileSync(file, 'utf8')).toContain('rt-seeded');
}

async function postChatAndReadSseText(body: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return await response.text();
}
