import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  openSettingsDialog,
  STORAGE_KEY,
  waitForLoadingToClear,
} from '@/playwright/amr';
import { routeAgents } from '@/playwright/mock-factory';

type VelaMockState = {
  loggedIn: boolean;
  loginRequests: number;
  logoutRequests: number;
  statusRequests: number;
};

test('[P1] AMR card authorizes through daemon login status and returns to authorize on sign out', async ({
  page,
}) => {
  const state: VelaMockState = {
    loggedIn: false,
    loginRequests: 0,
    logoutRequests: 0,
    statusRequests: 0,
  };
  await wireDaemonMocks(page, state);
  await seedConfig(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForLoadingToClear(page);
  const dialog = await openSettingsDialog(page);
  const amrCard = dialog
    .locator('.amr-agent-card, .agent-card-installed')
    .filter({ hasText: /Open Design AMR|AMR \(vela\)/i })
    .first();

  await expect(amrCard).toBeVisible();
  await expect.poll(() => state.statusRequests).toBeGreaterThan(0);

  const signInButton = amrCard.getByRole('button', {
    name: /^(Authorize|Sign in)$/,
  });
  await expect(signInButton).toBeVisible();
  await signInButton.click();
  await expect.poll(() => state.loginRequests).toBe(1);

  const signOutButton = amrCard.getByRole('button', { name: /^Sign out$/ });
  await expect(signOutButton).toBeVisible({ timeout: 10_000 });
  await expect(amrCard).toContainText('pill-test@example.com');

  await signOutButton.click();
  await expect.poll(() => state.logoutRequests).toBe(1);
  await expect(
    amrCard.getByRole('button', { name: /^(Authorize|Sign in)$/ }),
  ).toBeVisible({ timeout: 10_000 });
});

async function wireDaemonMocks(
  page: Page,
  state: VelaMockState,
): Promise<void> {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}',
    });
  });
  await routeAgents(page, [
    {
      id: 'amr',
      name: 'AMR (vela)',
      bin: 'vela',
      versionArgs: ['--version'],
      available: true,
      authStatus: null,
      modelsSource: 'fallback',
      models: [{ id: 'gpt-5.4-mini', label: 'gpt-5.4-mini' }],
      path: '/usr/local/bin/vela',
      version: null,
    },
  ]);
  await page.route('**/api/app-config', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ json: { config: baseStorageConfig() } });
  });
  await page.route('**/api/integrations/vela/status', async (route) => {
    state.statusRequests += 1;
    await route.fulfill({
      json: state.loggedIn
        ? {
            loggedIn: true,
            profile: 'local',
            configPath: '/tmp/.amr/config.json',
            user: {
              id: 'fake-user',
              email: 'pill-test@example.com',
              name: 'Pill Test',
              plan: 'free',
            },
          }
        : {
            loggedIn: false,
            profile: 'local',
            user: null,
            configPath: '/tmp/.amr/config.json',
          },
    });
  });
  await page.route('**/api/integrations/vela/login', async (route) => {
    state.loginRequests += 1;
    state.loggedIn = true;
    await route.fulfill({
      status: 202,
      json: {
        pid: 4_242,
        startedAt: new Date().toISOString(),
        profile: 'local',
      },
    });
  });
  await page.route('**/api/integrations/vela/logout', async (route) => {
    state.logoutRequests += 1;
    state.loggedIn = false;
    await route.fulfill({ json: { ok: true } });
  });
}

async function seedConfig(page: Page): Promise<void> {
  await page.addInitScript(
    ({
      key,
      value,
    }: {
      readonly key: string;
      readonly value: Record<string, unknown>;
    }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: baseStorageConfig() },
  );
}

function baseStorageConfig(): Record<string, unknown> {
  return {
    mode: 'daemon',
    apiKey: '',
    baseUrl: '',
    model: '',
    agentId: 'amr',
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    privacyDecisionAt: 1,
    mediaProviders: {},
    agentModels: { amr: { model: 'gpt-5.4-mini', reasoning: 'default' } },
  };
}
