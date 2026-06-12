import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  amrConfigPath,
  forgetVelaLogin,
  readVelaLoginStatus,
  resolveAmrProfile,
  spawnVelaLogin,
} from '../../src/integrations/vela.js';

let originalHome: string | undefined;
let tmpHome: string;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE_VELA = path.resolve(HERE, '..', 'fixtures', 'fake-vela.mjs');

function writeConfig(payload: unknown): string {
  const dir = path.join(tmpHome, '.amr');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'config.json');
  writeFileSync(file, JSON.stringify(payload), 'utf8');
  return file;
}

function writeLegacyVelaConfig(payload: unknown): string {
  const dir = path.join(tmpHome, '.vela');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'config.json');
  writeFileSync(file, JSON.stringify(payload), 'utf8');
  return file;
}

beforeEach(() => {
  originalHome = process.env.HOME;
  tmpHome = mkdtempHome();
  process.env.HOME = tmpHome;
  delete process.env.OPEN_DESIGN_AMR_PROFILE;
  delete process.env.VELA_PROFILE;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  delete process.env.OPEN_DESIGN_AMR_PROFILE;
  delete process.env.VELA_PROFILE;
  delete process.env.FAKE_VELA_LOGIN_USER_EMAIL;
  rmSync(tmpHome, { recursive: true, force: true });
});

function mkdtempHome(): string {
  return mkdtempSync(path.join(tmpdir(), 'od-vela-test-'));
}

describe('resolveAmrProfile', () => {
  it('defaults to prod when OPEN_DESIGN_AMR_PROFILE is unset or empty', () => {
    expect(resolveAmrProfile({})).toBe('prod');
    expect(resolveAmrProfile({ OPEN_DESIGN_AMR_PROFILE: '   ' })).toBe('prod');
  });

  it('honors OPEN_DESIGN_AMR_PROFILE when set to a known profile', () => {
    expect(resolveAmrProfile({ OPEN_DESIGN_AMR_PROFILE: 'prod' })).toBe('prod');
    expect(resolveAmrProfile({ OPEN_DESIGN_AMR_PROFILE: 'local' })).toBe('local');
    expect(resolveAmrProfile({ OPEN_DESIGN_AMR_PROFILE: 'test' })).toBe('test');
  });

  it('ignores lower-priority VELA_PROFILE values', () => {
    expect(resolveAmrProfile({ VELA_PROFILE: 'local' })).toBe('prod');
    expect(
      resolveAmrProfile({
        OPEN_DESIGN_AMR_PROFILE: 'test',
        VELA_PROFILE: 'local',
      }),
    ).toBe('test');
  });

  it('warns for unknown OPEN_DESIGN_AMR_PROFILE values and falls back to prod', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveAmrProfile({ OPEN_DESIGN_AMR_PROFILE: 'evil' })).toBe('prod');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('OPEN_DESIGN_AMR_PROFILE'),
    );
    warn.mockRestore();
  });
});

describe('readVelaLoginStatus', () => {
  it('returns loggedIn=false when ~/.amr/config.json is absent', () => {
    const status = readVelaLoginStatus({ OPEN_DESIGN_AMR_PROFILE: 'local' });
    expect(status.loggedIn).toBe(false);
    expect(status.user).toBeNull();
    expect(status.profile).toBe('local');
    expect(status.configPath).toBe(amrConfigPath());
  });

  it('ignores legacy ~/.vela/config.json when ~/.amr/config.json is absent', () => {
    writeLegacyVelaConfig({
      profiles: {
        local: {
          runtimeKey: 'rt-legacy',
          user: { id: 'legacy-user', email: 'legacy@example.com' },
        },
      },
    });
    const status = readVelaLoginStatus({ OPEN_DESIGN_AMR_PROFILE: 'local' });
    expect(status.loggedIn).toBe(false);
    expect(status.user).toBeNull();
    expect(status.configPath).toBe(amrConfigPath());
  });

  it('treats configured AMR env credentials as logged in without leaking secrets', () => {
    const status = readVelaLoginStatus(
      { OPEN_DESIGN_AMR_PROFILE: 'local' },
      {
        VELA_RUNTIME_KEY: 'rt-env-secret',
        VELA_LINK_URL: 'https://openrouter.example/v1',
      },
    );
    expect(status.loggedIn).toBe(true);
    expect(status.user).toBeNull();
    expect(status.profile).toBe('local');
    expect(JSON.stringify(status)).not.toContain('rt-env-secret');
  });

  it('requires both env runtime key and link URL before reporting env-only login', () => {
    expect(
      readVelaLoginStatus(
        { OPEN_DESIGN_AMR_PROFILE: 'local' },
        { VELA_RUNTIME_KEY: 'rt-env-secret' },
      ).loggedIn,
    ).toBe(false);
    expect(
      readVelaLoginStatus(
        { OPEN_DESIGN_AMR_PROFILE: 'local' },
        { VELA_LINK_URL: 'https://openrouter.example/v1' },
      ).loggedIn,
    ).toBe(false);
  });

  it('returns loggedIn=true with user info when the active profile has a runtimeKey', () => {
    writeConfig({
      profiles: {
        local: {
          runtimeKey: 'rt-secret-abc',
          controlKey: 'ck-secret',
          apiUrl: 'http://localhost:18080',
          linkUrl: 'http://localhost:18081',
          user: {
            id: 'user-1',
            email: 'leaf@example.com',
            name: 'Leaf User',
            image: 'https://example.com/avatar.png',
            plan: 'free',
          },
        },
      },
    });
    const status = readVelaLoginStatus({ OPEN_DESIGN_AMR_PROFILE: 'local' });
    expect(status.loggedIn).toBe(true);
    expect(status.profile).toBe('local');
    expect(status.user?.email).toBe('leaf@example.com');
    expect(status.user?.plan).toBe('free');
    expect(JSON.stringify(status)).not.toContain('rt-secret-abc');
    expect(JSON.stringify(status)).not.toContain('ck-secret');
  });

  it('isolates profiles', () => {
    writeConfig({
      profiles: {
        local: {
          runtimeKey: 'rt-local',
          user: { id: 'u', email: 'leaf@example.com' },
        },
      },
    });
    expect(readVelaLoginStatus({ OPEN_DESIGN_AMR_PROFILE: 'local' }).loggedIn).toBe(true);
    expect(readVelaLoginStatus({ OPEN_DESIGN_AMR_PROFILE: 'prod' }).loggedIn).toBe(false);
  });

  it('treats malformed JSON as logged out rather than crashing', () => {
    const file = path.join(tmpHome, '.amr', 'config.json');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '{not json', 'utf8');
    expect(readVelaLoginStatus({ OPEN_DESIGN_AMR_PROFILE: 'local' }).loggedIn).toBe(false);
  });
});

describe('forgetVelaLogin', () => {
  it('removes only the resolved profile credentials and preserves endpoint config', () => {
    const file = writeConfig({
      version: 1,
      profiles: {
        local: {
          runtimeKey: 'rt',
          controlKey: 'ck',
          apiUrl: 'http://localhost:18080',
          linkUrl: 'http://localhost:18081',
          user: { id: 'u', email: 'e' },
        },
        prod: {
          runtimeKey: 'rt-prod',
          user: { id: 'p', email: 'prod@example.com' },
        },
      },
      otherTopLevel: true,
    });

    forgetVelaLogin({ OPEN_DESIGN_AMR_PROFILE: 'local' });

    const next = JSON.parse(readFileSync(file, 'utf8'));
    expect(next.otherTopLevel).toBe(true);
    expect(next.profiles.local.runtimeKey).toBeUndefined();
    expect(next.profiles.local.controlKey).toBeUndefined();
    expect(next.profiles.local.user).toBeUndefined();
    expect(next.profiles.local.apiUrl).toBe('http://localhost:18080');
    expect(next.profiles.local.linkUrl).toBe('http://localhost:18081');
    expect(next.profiles.prod.runtimeKey).toBe('rt-prod');
  });

  it('is idempotent when the config file does not exist', () => {
    expect(() => forgetVelaLogin()).not.toThrow();
  });
});

describe('spawnVelaLogin', () => {
  it('returns an actionable error when no vela binary can be resolved', async () => {
    const originalPath = process.env.PATH;
    const originalResourceRoot = process.env.OD_RESOURCE_ROOT;
    try {
      process.env.PATH = '';
      delete process.env.OD_RESOURCE_ROOT;
      await expect(
        spawnVelaLogin({
          baseEnv: { ...process.env, HOME: tmpHome },
          configuredEnv: {},
        }),
      ).rejects.toThrow('vela binary not found');
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalResourceRoot === undefined) delete process.env.OD_RESOURCE_ROOT;
      else process.env.OD_RESOURCE_ROOT = originalResourceRoot;
    }
  });

  it('spawns the configured vela binary and writes only the resolved AMR profile', async () => {
    const result = await spawnVelaLogin({
      baseEnv: {
        ...process.env,
        HOME: tmpHome,
        OPEN_DESIGN_AMR_PROFILE: 'test',
        VELA_PROFILE: 'prod',
        FAKE_VELA_LOGIN_USER_EMAIL: 'spawn-login@example.com',
      },
      configuredEnv: {
        VELA_BIN: FAKE_VELA,
      },
    });

    expect(result.pid).toBeGreaterThan(0);
    expect(result.profile).toBe('test');

    const file = path.join(tmpHome, '.amr', 'config.json');
    await waitFor(() => existsSync(file));

    const next = JSON.parse(readFileSync(file, 'utf8'));
    expect(next.profiles.test.user.email).toBe('spawn-login@example.com');
    expect(next.profiles.prod).toBeUndefined();
  });

  it('passes Open Design AMR attribution env to vela login', async () => {
    const envOut = path.join(tmpHome, 'vela-env.json');
    const script = path.join(tmpHome, 'record-vela-env.mjs');
    writeFileSync(
      script,
      `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

writeFileSync(process.env.FAKE_VELA_ENV_OUT, JSON.stringify({
  entryId: process.env.OPEN_DESIGN_AMR_ENTRY_ID,
  source: process.env.OPEN_DESIGN_AMR_ENTRY_SOURCE,
  occurredAt: process.env.OPEN_DESIGN_AMR_ENTRY_AT,
  origin: process.env.OPEN_DESIGN_AMR_ORIGIN,
}), 'utf8');
`,
      'utf8',
    );
    chmodSync(script, 0o755);

    const result = await spawnVelaLogin({
      baseEnv: {
        ...process.env,
        HOME: tmpHome,
        FAKE_VELA_ENV_OUT: envOut,
      },
      configuredEnv: {
        VELA_BIN: script,
      },
      attribution: {
        entryId: 'od-amr-entry-env',
        sourceProduct: 'open_design',
        sourceDetail: 'chat_error_authorize_retry',
        occurredAt: '2026-06-03T12:00:00.000Z',
      },
    });

    expect(result.pid).toBeGreaterThan(0);
    await waitFor(() => existsSync(envOut));
    expect(JSON.parse(readFileSync(envOut, 'utf8'))).toEqual({
      entryId: 'od-amr-entry-env',
      source: 'chat_error_authorize_retry',
      occurredAt: '2026-06-03T12:00:00.000Z',
      origin: 'open_design',
    });
  });
});

async function waitFor(
  probe: () => boolean,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (probe()) return;
    if (Date.now() >= deadline) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
