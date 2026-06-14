import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { openSettingsDialog } from '@/playwright/amr';

const STORAGE_KEY = 'open-design:config';

function baseConfig(): Record<string, unknown> {
  return {
    mode: 'daemon',
    apiKey: '',
    apiProtocol: 'anthropic',
    apiVersion: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    apiProviderBaseUrl: 'https://api.anthropic.com',
    agentId: 'codex',
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    agentCliEnv: {},
    privacyDecisionAt: 1,
    telemetry: { metrics: false, content: false, artifactManifest: false },
  };
}

test('[P1] media provider edits autosave and restore after reopening settings', async ({ page }) => {
  const mediaConfigWrites: unknown[] = [];
  await seedSettingsBase(page);
  await routeBootstrapApis(page, mediaConfigWrites);

  let dialog = await openMediaSettings(page);
  await dialog.getByLabel('FishAudio API key').fill('fish-key');
  await dialog.getByLabel('FishAudio Base URL').fill('https://fish.example.com');

  await page.waitForFunction(
    ({ key }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed.mediaProviders?.fishaudio?.apiKey === 'fish-key'
        && parsed.mediaProviders?.fishaudio?.baseUrl === 'https://fish.example.com';
    },
    { key: STORAGE_KEY },
  );

  await expect(dialog.getByText('All changes saved')).toBeVisible();
  expect(mediaConfigWrites.length).toBeGreaterThan(0);

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  dialog = await openMediaSettingsFromCurrentPage(page);
  await expect(dialog.getByLabel('FishAudio API key')).toHaveValue('fish-key');
  await expect(dialog.getByLabel('FishAudio Base URL')).toHaveValue('https://fish.example.com');
});

async function seedSettingsBase(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { readonly key: string; readonly value: Record<string, unknown> }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: baseConfig() },
  );
}

async function routeBootstrapApis(page: Page, mediaConfigWrites: unknown[]): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === '/api/health') {
      await fulfillJson(route, { ok: true });
      return;
    }
    if (path === '/api/agents') {
      await fulfillJson(route, {
        agents: [
          {
            id: 'codex',
            name: 'Codex CLI',
            bin: 'codex',
            available: true,
            version: '0.130.0',
            models: [{ id: 'default', label: 'Default' }],
          },
        ],
      });
      return;
    }
    if (path === '/api/app-config') {
      await fulfillJson(route, method === 'GET' ? { config: baseConfig() } : { ok: true });
      return;
    }
    if (path === '/api/connectors/composio/config') {
      await fulfillJson(route, { configured: false, apiKeyTail: '' });
      return;
    }
    if (path === '/api/media/config') {
      if (method === 'PUT') mediaConfigWrites.push(route.request().postDataJSON());
      await fulfillJson(route, method === 'GET' ? { providers: {} } : { ok: true });
      return;
    }
    if (path === '/api/skills') {
      await fulfillJson(route, { skills: [] });
      return;
    }
    if (path === '/api/design-systems') {
      await fulfillJson(route, { designSystems: [] });
      return;
    }
    if (path === '/api/projects') {
      await fulfillJson(route, { projects: [] });
      return;
    }
    if (path === '/api/templates') {
      await fulfillJson(route, { templates: [] });
      return;
    }
    if (path === '/api/prompt-templates') {
      await fulfillJson(route, { promptTemplates: [] });
      return;
    }

    await fulfillJson(route, {});
  });
}

async function openMediaSettings(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 15_000 });
  return openMediaSettingsFromCurrentPage(page);
}

async function openMediaSettingsFromCurrentPage(page: Page) {
  const dialog = await openSettingsDialog(page);
  await dialog.getByRole('button', { name: /^Media providers$/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Media providers' })).toBeVisible();
  return dialog;
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
