import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

const execFileAsync = promisify(execFile);
const STORAGE_KEY = 'open-design:config';

type ManifestFile = {
  readonly name?: string;
  readonly missing?: boolean;
};

test.describe.configure({ timeout: 45_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        mode: 'daemon',
        apiKey: '',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-5',
        agentId: 'mock',
        skillId: null,
        designSystemId: null,
        onboardingCompleted: true,
        agentModels: {},
        privacyDecisionAt: 1,
        telemetry: { metrics: false, content: false, artifactManifest: false },
      }),
    );
  }, STORAGE_KEY);
});

test('[P1] diagnostics export zip includes daemon, web, and desktop log entries', async ({ page }) => {
  const response = await page.request.get('/api/diagnostics/export');
  expect(response.ok(), await response.text()).toBeTruthy();
  expect(response.headers()['content-type']).toContain('application/zip');

  const tmpRoot = await mkdtemp(path.join(tmpdir(), 'od-diagnostics-e2e-'));
  try {
    const zipPath = path.join(tmpRoot, 'diagnostics.zip');
    await writeFile(zipPath, await response.body());

    const names = await unzipList(zipPath);
    expect(names).toEqual(expect.arrayContaining([
      'summary/manifest.json',
      'logs/daemon/latest.log',
      'logs/web/latest.log',
      'logs/desktop/latest.log',
    ]));

    const manifest: unknown = JSON.parse(await unzipRead(zipPath, 'summary/manifest.json'));
    const manifestNames = new Set(manifestFiles(manifest).map((file) => file.name).filter(isString));
    expect(manifestNames.has('logs/daemon/latest.log')).toBe(true);
    expect(manifestNames.has('logs/web/latest.log')).toBe(true);
    expect(manifestNames.has('logs/desktop/latest.log')).toBe(true);

    await expectLogEntry(zipPath, 'logs/daemon/latest.log');
    await expectLogEntry(zipPath, 'logs/web/latest.log');
    await expectLogEntry(zipPath, 'logs/desktop/latest.log');
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});

async function expectLogEntry(zipPath: string, entryName: string): Promise<void> {
  const log = await unzipRead(zipPath, entryName);
  expect(log.length, entryName).toBeGreaterThan(0);
}

async function unzipList(zipPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath]);
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function unzipRead(zipPath: string, entryName: string): Promise<string> {
  const { stdout } = await execFileAsync('unzip', ['-p', zipPath, entryName], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

function manifestFiles(value: unknown): readonly ManifestFile[] {
  if (!hasFilesProperty(value) || !Array.isArray(value.files)) return [];
  return value.files.filter(isManifestFile);
}

function hasFilesProperty(value: unknown): value is { readonly files?: unknown } {
  return typeof value === 'object' && value !== null;
}

function isManifestFile(value: unknown): value is ManifestFile {
  if (typeof value !== 'object' || value === null) return false;
  if (hasNameProperty(value) && typeof value.name !== 'string') return false;
  if (hasMissingProperty(value) && typeof value.missing !== 'boolean') return false;
  return true;
}

function hasNameProperty(value: object): value is { readonly name: unknown } {
  return 'name' in value;
}

function hasMissingProperty(value: object): value is { readonly missing: unknown } {
  return 'missing' in value;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
