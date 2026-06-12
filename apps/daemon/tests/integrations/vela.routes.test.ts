import type http from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readAppConfig, writeAppConfig, type AppConfigPrefs } from '../../src/app-config.js';
import { cancelVelaLogin } from '../../src/integrations/vela.js';
import { amrModelLoadingCache } from '../../src/runtimes/amr-model-cache.js';
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

async function getJson<T = unknown>(url: string): Promise<{ status: number; body: T }> {
  const resp = await fetch(url);
  const body = (await resp.json()) as T;
  return { status: resp.status, body };
}

async function postJson<T = unknown>(url: string): Promise<{ status: number; body: T }> {
  const resp = await fetch(url, { method: 'POST' });
  const body = (await resp.json()) as T;
  return { status: resp.status, body };
}

function configPath(): string {
  return path.join(tmpHome, '.amr', 'config.json');
}

function legacyVelaConfigPath(): string {
  return path.join(tmpHome, '.vela', 'config.json');
}

function seedLogin(profile: string, payload: Record<string, unknown> = {}): void {
  const dir = path.dirname(configPath());
  mkdirSync(dir, { recursive: true });
  const full = {
    profiles: {
      [profile]: {
        runtimeKey: 'rt-seeded-key',
        controlKey: 'ck-seeded-key',
        apiUrl: 'http://localhost:18080',
        linkUrl: 'http://localhost:18081',
        user: {
          id: 'user-seed',
          email: 'seed@example.com',
          plan: 'free',
          ...((payload.user as Record<string, unknown>) ?? {}),
        },
        ...payload,
      },
    },
  };
  writeFileSync(configPath(), JSON.stringify(full, null, 2), 'utf8');
}

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
  tmpHome = mkdtempSync(path.join(tmpdir(), 'od-vela-routes-'));
  process.env.HOME = tmpHome;
  process.env.OPEN_DESIGN_AMR_PROFILE = 'local';
  process.env.VELA_PROFILE = 'prod';
});

afterEach(async () => {
  cancelVelaLogin();
  amrModelLoadingCache.resetForTests();
  const dataDir = process.env.OD_DATA_DIR as string;
  await writeAppConfig(dataDir, previousConfig as unknown as Record<string, unknown>);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  delete process.env.OPEN_DESIGN_AMR_PROFILE;
  delete process.env.VELA_PROFILE;
  delete process.env.FAKE_VELA_LOGIN_DELAY_MS;
  delete process.env.FAKE_VELA_LOGIN_FAIL;
  delete process.env.FAKE_VELA_LOGIN_USER_EMAIL;
  delete process.env.FAKE_VELA_LOGIN_USER_PLAN;
  delete process.env.VELA_RUNTIME_KEY;
  delete process.env.VELA_LINK_URL;
  rmSync(tmpHome, { recursive: true, force: true });
});

describe('GET /api/integrations/vela/status', () => {
  it('reports loggedIn=false when ~/.amr/config.json is absent', async () => {
    const { status, body } = await getJson<{
      loggedIn: boolean;
      loginInFlight: boolean;
      profile: string;
      user: { email?: string } | null;
      configPath: string;
    }>(`${baseUrl}/api/integrations/vela/status`);
    expect(status).toBe(200);
    expect(body.loggedIn).toBe(false);
    expect(body.loginInFlight).toBe(false);
    expect(body.profile).toBe('local');
    expect(body.user).toBeNull();
    expect(body.configPath.startsWith(tmpHome)).toBe(true);
    expect(body.configPath).toContain('/.amr/');
  });

  it('ignores legacy ~/.vela/config.json when reporting AMR status', async () => {
    const legacyPath = legacyVelaConfigPath();
    mkdirSync(path.dirname(legacyPath), { recursive: true });
    writeFileSync(
      legacyPath,
      JSON.stringify({
        profiles: {
          local: {
            runtimeKey: 'rt-legacy',
            user: { id: 'legacy-user', email: 'legacy@example.com' },
          },
        },
      }),
      'utf8',
    );

    const { status, body } = await getJson<{
      loggedIn: boolean;
      user: { email?: string } | null;
      configPath: string;
    }>(`${baseUrl}/api/integrations/vela/status`);
    expect(status).toBe(200);
    expect(body.loggedIn).toBe(false);
    expect(body.user).toBeNull();
    expect(body.configPath).toContain('/.amr/');
  });

  it('reports Settings-configured AMR env credentials as logged in without leaking them', async () => {
    const dataDir = process.env.OD_DATA_DIR as string;
    await writeAppConfig(dataDir, {
      ...previousConfig,
      agentCliEnv: {
        ...(previousConfig.agentCliEnv ?? {}),
        amr: {
          ...((previousConfig.agentCliEnv?.amr as Record<string, string>) ?? {}),
          VELA_BIN: FAKE_VELA,
          VELA_RUNTIME_KEY: 'rt-env-secret',
          VELA_LINK_URL: 'https://openrouter.example/v1',
        },
      },
    });

    const { status, body } = await getJson<{
      loggedIn: boolean;
      user: { email?: string } | null;
    }>(`${baseUrl}/api/integrations/vela/status`);
    expect(status).toBe(200);
    expect(body.loggedIn).toBe(true);
    expect(body.user).toBeNull();
    expect(JSON.stringify(body)).not.toContain('rt-env-secret');
  });

  it('reports status for the Settings-configured AMR profile', async () => {
    const dataDir = process.env.OD_DATA_DIR as string;
    seedLogin('local', {
      user: { id: 'local-user', email: 'settings-local@example.com' },
    });
    const cfg = JSON.parse(readFileSync(configPath(), 'utf8'));
    cfg.profiles.prod = {};
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
    process.env.OPEN_DESIGN_AMR_PROFILE = 'prod';
    await writeAppConfig(dataDir, {
      ...previousConfig,
      agentCliEnv: {
        ...(previousConfig.agentCliEnv ?? {}),
        amr: {
          VELA_BIN: FAKE_VELA,
          OPEN_DESIGN_AMR_PROFILE: 'local',
        },
      },
    });

    const { status, body } = await getJson<{
      loggedIn: boolean;
      profile: string;
      user: { email?: string } | null;
    }>(`${baseUrl}/api/integrations/vela/status`);
    expect(status).toBe(200);
    expect(body.loggedIn).toBe(true);
    expect(body.profile).toBe('local');
    expect(body.user?.email).toBe('settings-local@example.com');
  });

  it('never leaks runtimeKey or controlKey in the status payload', async () => {
    seedLogin('local', {
      runtimeKey: 'rt-very-secret-do-not-leak',
      controlKey: 'ck-also-secret',
    });
    const resp = await fetch(`${baseUrl}/api/integrations/vela/status`);
    const text = await resp.text();
    expect(text).not.toContain('rt-very-secret-do-not-leak');
    expect(text).not.toContain('ck-also-secret');
  });
});

describe('POST /api/integrations/vela/login', () => {
  it('spawns the configured vela binary and surfaces a pid + startedAt + profile', async () => {
    process.env.FAKE_VELA_LOGIN_USER_EMAIL = 'login-route@example.com';
    const { status, body } = await postJson<{
      pid: number;
      startedAt: string;
      profile: string;
    }>(`${baseUrl}/api/integrations/vela/login`);
    expect(status).toBe(202);
    expect(typeof body.pid).toBe('number');
    expect(body.pid).toBeGreaterThan(0);
    expect(body.profile).toBe('local');
    expect(body.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await waitFor(() => existsSync(configPath()));

    const cfg = JSON.parse(readFileSync(configPath(), 'utf8'));
    expect(cfg?.profiles?.local?.user?.email).toBe('login-route@example.com');
    expect(cfg?.profiles?.prod).toBeUndefined();
  });

  it('passes the Settings-configured AMR profile to vela login', async () => {
    const dataDir = process.env.OD_DATA_DIR as string;
    process.env.OPEN_DESIGN_AMR_PROFILE = 'prod';
    process.env.VELA_PROFILE = 'prod';
    process.env.FAKE_VELA_LOGIN_USER_EMAIL = 'settings-login@example.com';
    await writeAppConfig(dataDir, {
      ...previousConfig,
      agentCliEnv: {
        ...(previousConfig.agentCliEnv ?? {}),
        amr: {
          VELA_BIN: FAKE_VELA,
          OPEN_DESIGN_AMR_PROFILE: 'local',
        },
      },
    });

    const { status, body } = await postJson<{
      pid: number;
      profile: string;
    }>(`${baseUrl}/api/integrations/vela/login`);
    expect(status).toBe(202);
    expect(body.profile).toBe('local');

    await waitFor(() => existsSync(configPath()));

    const cfg = JSON.parse(readFileSync(configPath(), 'utf8'));
    expect(cfg?.profiles?.local?.user?.email).toBe('settings-login@example.com');
    expect(cfg?.profiles?.prod).toBeUndefined();
  });

  it('returns 409 when a login subprocess is already in flight', async () => {
    process.env.FAKE_VELA_LOGIN_DELAY_MS = '2000';

    const first = await postJson(`${baseUrl}/api/integrations/vela/login`);
    expect(first.status).toBe(202);

    const second = await postJson<{ error?: string }>(
      `${baseUrl}/api/integrations/vela/login`,
    );
    expect(second.status).toBe(409);
    expect(String(second.body.error || '')).toMatch(/already running/i);
  });

  it('returns an error when the login subprocess exits immediately with stderr', async () => {
    process.env.FAKE_VELA_LOGIN_FAIL = 'profile "prod" api URL: is not configured';

    const { status, body } = await postJson<{ error?: string }>(
      `${baseUrl}/api/integrations/vela/login`,
    );

    expect(status).toBe(500);
    expect(body.error).toContain('profile "prod" api URL: is not configured');
  });

  it('surfaces and cancels a delayed login subprocess', async () => {
    process.env.FAKE_VELA_LOGIN_DELAY_MS = '30000';

    const login = await postJson(`${baseUrl}/api/integrations/vela/login`);
    expect(login.status).toBe(202);

    const during = await getJson<{ loggedIn: boolean; loginInFlight: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(during.body.loggedIn).toBe(false);
    expect(during.body.loginInFlight).toBe(true);

    const cancel = await postJson<{ canceled: boolean; pids: number[] }>(
      `${baseUrl}/api/integrations/vela/login/cancel`,
    );
    expect(cancel.status).toBe(200);
    expect(cancel.body.canceled).toBe(true);
    expect(cancel.body.pids.length).toBeGreaterThan(0);

    await waitFor(async () => {
      const next = await getJson<{ loginInFlight: boolean }>(
        `${baseUrl}/api/integrations/vela/status`,
      );
      return !next.body.loginInFlight;
    });

    const after = await getJson<{ loggedIn: boolean; loginInFlight: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(after.body.loggedIn).toBe(false);
    expect(after.body.loginInFlight).toBe(false);
    expect(existsSync(configPath())).toBe(false);
  });
});

describe('POST /api/integrations/vela/logout', () => {
  it('removes only resolved profile credentials so endpoint config is reusable', async () => {
    seedLogin('local');
    const cfg = JSON.parse(readFileSync(configPath(), 'utf8'));
    cfg.profiles.prod = {
      runtimeKey: 'rt-prod',
      user: { id: 'prod-user', email: 'prod@example.com' },
    };
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');

    const { status, body } = await postJson<{ ok?: boolean }>(
      `${baseUrl}/api/integrations/vela/logout`,
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const next = JSON.parse(readFileSync(configPath(), 'utf8'));
    expect(next.profiles.local.runtimeKey).toBeUndefined();
    expect(next.profiles.local.controlKey).toBeUndefined();
    expect(next.profiles.local.user).toBeUndefined();
    expect(next.profiles.local.apiUrl).toBe('http://localhost:18080');
    expect(next.profiles.local.linkUrl).toBe('http://localhost:18081');
    expect(next.profiles.prod.runtimeKey).toBe('rt-prod');

    const after = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(after.body.loggedIn).toBe(false);
  });

  it('clears Settings-backed AMR auth env while preserving executable config', async () => {
    const dataDir = process.env.OD_DATA_DIR as string;
    await writeAppConfig(dataDir, {
      agentCliEnv: {
        ...(previousConfig.agentCliEnv ?? {}),
        amr: {
          VELA_BIN: FAKE_VELA,
          VELA_OPENCODE_BIN: '/tmp/opencode',
          VELA_RUNTIME_KEY: 'rt-env-secret',
          VELA_LINK_URL: 'https://openrouter.example/v1',
        },
      },
    });

    const before = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(before.body.loggedIn).toBe(true);

    const { status, body } = await postJson<{ ok?: boolean }>(
      `${baseUrl}/api/integrations/vela/logout`,
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const after = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(after.body.loggedIn).toBe(false);

    const next = await readAppConfig(dataDir);
    expect(next.agentCliEnv?.amr?.VELA_BIN).toBe(FAKE_VELA);
    expect(next.agentCliEnv?.amr?.VELA_OPENCODE_BIN).toBe('/tmp/opencode');
    expect(next.agentCliEnv?.amr?.VELA_RUNTIME_KEY).toBeUndefined();
    expect(next.agentCliEnv?.amr?.VELA_LINK_URL).toBeUndefined();
  });

  it('clears both Settings-backed env credentials and same-profile ~/.amr credentials', async () => {
    const dataDir = process.env.OD_DATA_DIR as string;
    seedLogin('local', {
      user: { id: 'local-user', email: 'local@example.com' },
    });
    await writeAppConfig(dataDir, {
      ...previousConfig,
      agentCliEnv: {
        ...(previousConfig.agentCliEnv ?? {}),
        amr: {
          VELA_BIN: FAKE_VELA,
          OPEN_DESIGN_AMR_PROFILE: 'local',
          VELA_RUNTIME_KEY: 'rt-env-secret',
          VELA_LINK_URL: 'https://openrouter.example/v1',
        },
      },
    });

    const before = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(before.body.loggedIn).toBe(true);

    const { status, body } = await postJson<{ ok?: boolean }>(
      `${baseUrl}/api/integrations/vela/logout`,
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const nextConfig = await readAppConfig(dataDir);
    expect(nextConfig.agentCliEnv?.amr?.VELA_RUNTIME_KEY).toBeUndefined();
    expect(nextConfig.agentCliEnv?.amr?.VELA_LINK_URL).toBeUndefined();

    const nextAmrConfig = JSON.parse(readFileSync(configPath(), 'utf8'));
    expect(nextAmrConfig.profiles.local.runtimeKey).toBeUndefined();
    expect(nextAmrConfig.profiles.local.user).toBeUndefined();
    expect(nextAmrConfig.profiles.local.linkUrl).toBe('http://localhost:18081');
  });

  it('clears daemon-process AMR auth env for the current daemon session', async () => {
    process.env.VELA_RUNTIME_KEY = 'rt-process-secret';
    process.env.VELA_LINK_URL = 'https://openrouter.example/v1';

    const before = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(before.body.loggedIn).toBe(true);

    const { status, body } = await postJson<{ ok?: boolean }>(
      `${baseUrl}/api/integrations/vela/logout`,
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(process.env.VELA_RUNTIME_KEY).toBeUndefined();
    expect(process.env.VELA_LINK_URL).toBeUndefined();

    const after = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(after.body.loggedIn).toBe(false);
  });
});

describe('login status round trip', () => {
  it('flips loggedIn=false to loggedIn=true after a successful login subprocess', async () => {
    process.env.FAKE_VELA_LOGIN_USER_EMAIL = 'round-trip@example.com';
    process.env.FAKE_VELA_LOGIN_USER_PLAN = 'pro';

    const before = await getJson<{ loggedIn: boolean }>(
      `${baseUrl}/api/integrations/vela/status`,
    );
    expect(before.body.loggedIn).toBe(false);

    const login = await postJson(`${baseUrl}/api/integrations/vela/login`);
    expect(login.status).toBe(202);

    await waitFor(() => existsSync(configPath()));

    const after = await getJson<{
      loggedIn: boolean;
      user: { email?: string; plan?: string } | null;
    }>(`${baseUrl}/api/integrations/vela/status`);
    expect(after.body.loggedIn).toBe(true);
    expect(after.body.user?.email).toBe('round-trip@example.com');
    expect(after.body.user?.plan).toBe('pro');
  });
});

async function waitFor(
  probe: () => boolean | Promise<boolean>,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await probe()) return;
    if (Date.now() >= deadline) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
