import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const STORAGE_KEY = 'open-design:config';

type UserSystem = {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly surface: 'web' | 'image' | 'video' | 'audio';
  readonly source: 'user';
  status: 'draft' | 'published';
  readonly updatedAt: string;
};

function baseConfig(): Record<string, unknown> {
  return {
    mode: 'daemon',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: 'codex',
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    agentModels: {},
    privacyDecisionAt: 1,
    telemetry: { metrics: false, content: false, artifactManifest: false },
  };
}

test('[P1] publishing a user design system promotes it to the default system in the manager', async ({ page }) => {
  await seedEntryBase(page);
  const systems: UserSystem[] = [
    {
      id: 'brand-alpha',
      title: 'Brand Alpha',
      category: 'Productivity & SaaS',
      summary: 'Draft internal design system.',
      surface: 'web',
      source: 'user',
      status: 'draft',
      updatedAt: '2026-05-28T01:00:00.000Z',
    },
    {
      id: 'brand-beta',
      title: 'Brand Beta',
      category: 'Productivity & SaaS',
      summary: 'Published baseline system.',
      surface: 'web',
      source: 'user',
      status: 'published',
      updatedAt: '2026-05-28T00:00:00.000Z',
    },
  ];
  const { persistedDesignSystemIds } = await routeDesignSystemsManager(page, systems);

  await gotoEntryHome(page);
  await page.getByTestId('entry-nav-design-systems').click();
  await expect(page).toHaveURL(/\/design-systems$/);

  const manager = page.locator('section[aria-label="Design Systems"]');
  const alphaRow = manager.locator('.ds-user-row').filter({ hasText: 'Brand Alpha' });

  await expect(alphaRow.getByRole('button', { name: 'Make default' })).toHaveCount(0);
  await alphaRow.locator('.ds-status-toggle').click();
  await expect(alphaRow.locator('.ds-status-toggle')).toContainText('Published');
  await expect(alphaRow.getByText('Default')).toBeVisible();
  await expect.poll(() => persistedDesignSystemIds.at(-1)).toBe('brand-alpha');
});

async function seedEntryBase(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { readonly key: string; readonly value: Record<string, unknown> }) => {
      window.localStorage.setItem('od.entry.railOpen', 'true');
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: baseConfig() },
  );
}

async function routeDesignSystemsManager(
  page: Page,
  systems: UserSystem[],
): Promise<{ readonly persistedDesignSystemIds: Array<string | null | undefined> }> {
  const persistedDesignSystemIds: Array<string | null | undefined> = [];
  let currentConfig = baseConfig();

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
      if (method === 'GET') {
        await fulfillJson(route, { config: currentConfig });
        return;
      }
      const body = route.request().postDataJSON();
      persistedDesignSystemIds.push(readDesignSystemId(body));
      currentConfig = { ...currentConfig, ...recordFromUnknown(body) };
      await fulfillJson(route, { ok: true });
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
    if (/^\/api\/design-systems\/[^/]+$/.test(path) && method === 'PATCH') {
      const id = decodeURIComponent(path.split('/').at(-1) ?? '');
      const status = readStatus(route.request().postDataJSON());
      const system = systems.find((entry) => entry.id === id);
      if (system && status) system.status = status;
      const responseSystem = requireSystem(system ?? systems[0]);
      await fulfillJson(route, {
        designSystem: {
          ...responseSystem,
          body: `# ${responseSystem.title}`,
        },
      });
      return;
    }
    if (/^\/api\/design-systems\/[^/]+$/.test(path) && method === 'GET') {
      const id = decodeURIComponent(path.split('/').at(-1) ?? '');
      const system = requireSystem(systems.find((entry) => entry.id === id) ?? systems[0]);
      await fulfillJson(route, { designSystem: { ...system, body: `# ${system.title}` } });
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
    if (path === '/api/plugins') {
      await fulfillJson(route, { plugins: [] });
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

  return { persistedDesignSystemIds };
}

async function gotoEntryHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 15_000 });
}

function requireSystem(system: UserSystem | undefined): UserSystem {
  if (system) return system;
  throw new Error('design system fixture missing');
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

function readDesignSystemId(value: unknown): string | null | undefined {
  if (!value || typeof value !== 'object' || !('designSystemId' in value)) return undefined;
  const designSystemId = value.designSystemId;
  return typeof designSystemId === 'string' || designSystemId === null
    ? designSystemId
    : undefined;
}

function readStatus(value: unknown): UserSystem['status'] | undefined {
  if (!value || typeof value !== 'object' || !('status' in value)) return undefined;
  const status = value.status;
  return status === 'draft' || status === 'published' ? status : undefined;
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
