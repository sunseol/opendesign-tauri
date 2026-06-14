import type { Page, Route } from '@playwright/test';

export const STORAGE_KEY = 'open-design:config';

const STANDARD_CONFIG = {
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
};

const STANDARD_APP_CONFIG = {
  onboardingCompleted: true,
  agentId: 'mock',
  skillId: null,
  designSystemId: null,
  agentModels: {},
  privacyDecisionAt: 1,
  telemetry: { metrics: false, content: false, artifactManifest: false },
};

const STANDARD_MOCK_AGENT = {
  id: 'mock',
  name: 'Mock Agent',
  bin: 'mock-agent',
  available: true,
  version: 'test',
  models: [{ id: 'default', label: 'Default' }],
};

export async function applyStandardMocks(page: Page): Promise<void> {
  await applyStorageConfig(page);
  await routeMockAgents(page);
  await routeAppConfig(page);
}

export async function applyStorageConfig(page: Page): Promise<void> {
  const configJson = JSON.stringify(STANDARD_CONFIG);
  await page.addInitScript(
    ({ key, value }: { readonly key: string; readonly value: string }) => window.localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: configJson },
  );
}

export async function routeAppConfig(page: Page): Promise<void> {
  await page.route('**/api/app-config', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ json: { config: STANDARD_APP_CONFIG } });
  });
}

export async function routeMockAgents(page: Page): Promise<void> {
  await routeAgents(page, [STANDARD_MOCK_AGENT]);
}

export async function routeAgents(
  page: Page,
  agents: readonly unknown[],
): Promise<void> {
  await page.route('**/api/agents**', async (route) => {
    await fulfillAgentsRoute(route, agents);
  });
}

export async function fulfillAgentsRoute(
  route: Route,
  agents: readonly unknown[],
): Promise<void> {
  if (route.request().method() !== 'GET') {
    await route.continue();
    return;
  }

  const url = new URL(route.request().url());
  if (url.pathname !== '/api/agents') {
    await route.fallback();
    return;
  }

  if (url.searchParams.get('stream') !== '1') {
    await route.fulfill({ json: { agents } });
    return;
  }

  const agentEvents = agents
    .map((agent) => `event: agent\ndata: ${JSON.stringify(agent)}\n\n`)
    .join('');
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream; charset=utf-8',
    body: `${agentEvents}event: done\ndata: {}\n\n`,
  });
}
