import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { openSettingsDialog } from '@/playwright/amr';

const STORAGE_KEY = 'open-design:config';

type DesignSystemFixture = {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly surface: 'web' | 'image' | 'video' | 'audio';
  readonly swatches?: readonly string[];
  readonly source?: 'library' | 'user';
  readonly isEditable?: boolean;
};

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

test('[P1] imported local design system is visible immediately in settings', async ({ page }) => {
  await seedSettingsBase(page);
  const systems: DesignSystemFixture[] = [];
  const importedSystem: DesignSystemFixture = {
    id: 'acme-core',
    title: 'Acme Core',
    category: 'Productivity & SaaS',
    summary: 'Imported Acme product design system.',
    surface: 'web',
    swatches: ['#111827', '#4f46e5'],
    source: 'user',
    isEditable: true,
  };

  await routeBootstrapApis(page, systems, {
    importLocal: async (route) => {
      systems.push(importedSystem);
      await fulfillJson(route, { designSystem: importedSystem });
    },
  });

  const dialog = await openDesignSystemsSettings(page);
  await dialog.getByRole('button', { name: /Add design system/i }).click();
  await dialog.getByPlaceholder('/path/to/project').fill('/tmp/acme-design-system');
  await dialog.getByRole('button', { name: /Import from project/i }).click();

  await expect(dialog.getByText('Imported Acme Core')).toBeVisible();
  await dialog.getByRole('button', { name: /View imported design system/i }).click();
  await expect(dialog.locator('.library-ds-title', { hasText: 'Acme Core' })).toBeVisible();
  await expect(dialog.getByText('Imported Acme product design system.')).toBeVisible();
});

async function seedSettingsBase(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { readonly key: string; readonly value: Record<string, unknown> }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: baseConfig() },
  );
}

async function routeBootstrapApis(
  page: Page,
  systems: DesignSystemFixture[],
  options: { readonly importLocal: (route: Route) => Promise<void> },
): Promise<void> {
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
      await fulfillJson(route, method === 'GET' ? { providers: {} } : { ok: true });
      return;
    }
    if (path === '/api/design-systems' && method === 'GET') {
      await fulfillJson(route, { designSystems: systems });
      return;
    }
    if (path === '/api/design-systems/import/local' && method === 'POST') {
      await options.importLocal(route);
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

async function openDesignSystemsSettings(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 15_000 });
  const dialog = await openSettingsDialog(page);
  await dialog.getByRole('button', { name: /Design systems/i }).click();
  await expect(dialog.getByRole('heading', { name: /Design Systems/i })).toBeVisible();
  return dialog;
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
