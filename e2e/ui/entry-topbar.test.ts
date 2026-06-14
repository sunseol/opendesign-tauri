import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { routeAgents } from '@/playwright/mock-factory';

const STORAGE_KEY = 'open-design:config';
const OPEN_SETTINGS_LABEL = /Open settings|打开设置|開啟設定/i;

function homeConfig(): Record<string, unknown> {
  return {
    mode: 'daemon',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: 'codex',
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    agentModels: { codex: { model: 'default', reasoning: 'default' } },
    privacyDecisionAt: 1,
    telemetry: { metrics: false, content: false, artifactManifest: false },
  };
}

test('[P2] home topbar shows entry chips and links', async ({ page }) => {
  await seedEntryHome(page);
  await routeEntryTopbarApis(page);

  await gotoEntryHome(page);

  const topbar = page.locator('.entry-main__topbar');
  await expect(topbar).toBeVisible();

  const star = page.getByTestId('entry-star-badge');
  await expect(star).toBeVisible();
  await expect(star).toHaveAttribute('href', 'https://github.com/nexu-io/open-design');
  await expect(star).toContainText('Star');
  await expect(star).toContainText('51.6K');

  const discord = page.getByTestId('entry-discord-badge');
  await expect(discord).toBeVisible();
  await expect(discord).toHaveAttribute('href', 'https://discord.gg/mHAjSMV6gz');
  await expect(discord).toContainText('Join Discord');

  await expect(page.getByTestId('inline-model-switcher-chip')).toBeVisible();
  await expect(page.getByTestId('entry-use-everywhere-button')).toBeVisible();
  await expect(page.getByRole('button', { name: OPEN_SETTINGS_LABEL })).toBeVisible();
});

async function seedEntryHome(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { readonly key: string; readonly value: Record<string, unknown> }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: homeConfig() },
  );
}

async function routeEntryTopbarApis(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/nexu-io/open-design', async (route) => {
    await fulfillJson(route, { stargazers_count: 51_600 });
  });
  await routeAgents(page, [
    {
      id: 'codex',
      name: 'Codex CLI',
      bin: 'codex',
      available: true,
      version: '0.130.0',
      models: [{ id: 'default', label: 'Default' }],
    },
  ]);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === '/api/health') {
      await fulfillJson(route, { ok: true });
      return;
    }
    if (path === '/api/app-config') {
      await fulfillJson(route, method === 'GET' ? { config: homeConfig() } : { ok: true });
      return;
    }
    if (path === '/api/connectors/composio/config') {
      await fulfillJson(route, { configured: false, apiKeyTail: '' });
      return;
    }
    if (path === '/api/media/config') {
      await fulfillJson(route, method === 'GET' ? { providers: {} } : { ok: true });
      return;
    }
    if (path === '/api/design-systems') {
      await fulfillJson(route, { designSystems: [] });
      return;
    }
    if (path === '/api/skills') {
      await fulfillJson(route, { skills: [] });
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

async function gotoEntryHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 15_000 });
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
