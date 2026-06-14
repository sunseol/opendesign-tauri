import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { routeAgents } from '@/playwright/mock-factory';

const STORAGE_KEY = 'open-design:config';

const BASE_CONFIG = {
  mode: 'daemon',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  agentId: 'codex',
  skillId: null,
  designSystemId: null,
  onboardingCompleted: true,
  mediaProviders: {},
  agentModels: {},
  agentCliEnv: {},
  privacyDecisionAt: 1,
  telemetry: { metrics: false, content: false, artifactManifest: false },
} as const;

test.describe.configure({ timeout: 30_000 });

test.beforeEach(async ({ page }) => {
  await seedAutomationsBase(page);
});

test('[P0] renders automations hero metrics filters and saved rows', async ({ page }) => {
  await routeAutomationData(page, {
    projects: [],
    routines: [
      routineRecord('routine-active-1', 'Daily digest', true),
      routineRecord('routine-paused-1', 'Weekly release notes', false),
    ],
  });

  const view = await gotoAutomations(page);

  await expect(view.getByText('Plan recurring conversations for project work, Orbit digests, and live artifacts.')).toBeVisible();
  await expect(view.getByLabel('Automation summary')).toContainText('Active');
  await expect(view.getByLabel('Automation summary')).toContainText('Paused');
  await expect(view.getByLabel('Automation summary')).toContainText('Templates');
  await expect(view.getByLabel('Your automations')).toContainText('Daily digest');
  await expect(view.getByLabel('Your automations')).toContainText('Weekly release notes');

  const filters = view.getByRole('tablist', { name: 'Template filters' });
  await expect(filters.getByRole('tab', { name: /^All/i })).toHaveAttribute('aria-selected', 'true');
  await filters.getByRole('tab', { name: /Skills/i }).click();
  await expect(filters.getByRole('tab', { name: /Skills/i })).toHaveAttribute('aria-selected', 'true');
});

test('[P0] creates an automation and opens the manual run conversation', async ({ page }) => {
  const createBodies: Record<string, unknown>[] = [];
  await routeAutomationData(page, {
    createBodies,
    projects: [{ id: 'proj-1', name: 'Routine Test Project' }],
    routines: [],
  });

  const view = await gotoAutomations(page);
  await view.getByTestId('automations-new').click();

  const modal = page.getByTestId('automation-modal');
  await modal.getByTestId('automation-modal-title').fill('Weekly digest');
  await modal.getByTestId('automation-modal-prompt').fill('Summarize GitHub and design activity.');
  await modal.getByRole('button', { name: 'Create' }).click();

  await expect(view.getByText('Weekly digest')).toBeVisible();
  expect(createBodies[0]).toMatchObject({
    name: 'Weekly digest',
    prompt: 'Summarize GitHub and design activity.',
    schedule: { kind: 'daily', time: '09:00' },
    target: { mode: 'create_each_run' },
  });

  const row = view.locator('.automation-row', { hasText: 'Weekly digest' }).first();
  await row.getByRole('button', { name: 'Run' }).click();
  await expect(page).toHaveURL(/\/projects\/proj-run/);
});

type AutomationRouteState = {
  readonly createBodies?: Record<string, unknown>[];
  readonly projects: readonly Record<string, unknown>[];
  routines: Record<string, unknown>[];
};

async function seedAutomationsBase(page: Page): Promise<void> {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: BASE_CONFIG });

  await page.route('**/api/health', async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
  await routeAgents(page, [
    { id: 'codex', name: 'Codex CLI', bin: 'codex', available: true, version: '0.130.0', models: [{ id: 'default', label: 'Default' }] },
  ]);
  await page.route('**/api/app-config', async (route) => {
    await route.fulfill({ json: { config: BASE_CONFIG } });
  });
  await page.route('**/api/plugins', async (route) => {
    await route.fulfill({ json: { plugins: [] } });
  });
  await page.route('**/api/mcp/servers', async (route) => {
    await route.fulfill({ json: { servers: [], templates: [] } });
  });
  await page.route('**/api/design-systems', async (route) => {
    await route.fulfill({ json: { designSystems: [] } });
  });
}

async function routeAutomationData(page: Page, state: AutomationRouteState): Promise<void> {
  await page.route('**/api/projects', async (route) => {
    await route.fulfill({ json: { projects: state.projects } });
  });
  await page.route('**/api/automation-templates**', async (route) => {
    await route.fulfill({ json: { templates: [] } });
  });
  await page.route('**/api/automation-proposals**', async (route) => {
    await route.fulfill({ json: { proposals: [] } });
  });
  await page.route('**/api/automation-source-packets**', async (route) => {
    await route.fulfill({ json: { packets: [] } });
  });
  await page.route('**/api/routines**', async (route) => {
    await fulfillRoutineRoute(route, state);
  });
}

async function fulfillRoutineRoute(route: Route, state: AutomationRouteState): Promise<void> {
  const url = new URL(route.request().url());
  const method = route.request().method();
  if (url.pathname === '/api/routines' && method === 'GET') {
    await route.fulfill({ json: { routines: state.routines } });
    return;
  }
  if (url.pathname === '/api/routines' && method === 'POST') {
    const payload: unknown = route.request().postDataJSON();
    const body = isRecord(payload) ? payload : {};
    state.createBodies?.push(body);
    const routine = routineFromCreateBody('routine-created-1', body);
    state.routines = [routine, ...state.routines];
    await route.fulfill({ status: 201, json: { routine } });
    return;
  }
  const runMatch = /^\/api\/routines\/([^/]+)\/run$/.exec(url.pathname);
  if (runMatch && method === 'POST') {
    await route.fulfill({
      status: 202,
      json: {
        routine: state.routines[0] ?? routineRecord('routine-created-1', 'Weekly digest', true),
        run: manualRunRecord(),
        projectId: 'proj-run',
        conversationId: 'conv-run',
        agentRunId: 'agent-run-1',
      },
    });
    return;
  }
  await route.fulfill({ status: 404, json: {} });
}

async function gotoAutomations(page: Page) {
  await page.goto('/automations', { waitUntil: 'domcontentloaded' });
  const view = page.getByTestId('tasks-view');
  await expect(view.getByRole('heading', { name: 'Automations', exact: true })).toBeVisible();
  return view;
}

function routineRecord(id: string, name: string, enabled: boolean): Record<string, unknown> {
  const createdAt = enabled ? Date.now() : Date.now() - 60_000;
  return {
    id,
    name,
    prompt: enabled ? 'Summarize GitHub and design activity.' : 'Draft release notes.',
    schedule: enabled
      ? { kind: 'daily', time: '09:00', timezone: 'UTC' }
      : { kind: 'weekly', weekday: 1, time: '09:00', timezone: 'UTC' },
    target: { mode: 'create_each_run' },
    enabled,
    nextRunAt: enabled ? Date.now() + 3_600_000 : null,
    lastRun: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function routineFromCreateBody(id: string, body: Record<string, unknown>): Record<string, unknown> {
  return {
    id,
    name: stringField(body, 'name'),
    prompt: stringField(body, 'prompt'),
    schedule: isRecord(body.schedule) ? body.schedule : { kind: 'daily', time: '09:00', timezone: 'UTC' },
    target: isRecord(body.target) ? body.target : { mode: 'create_each_run' },
    enabled: true,
    nextRunAt: Date.now() + 3_600_000,
    lastRun: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function manualRunRecord(): Record<string, unknown> {
  return {
    runId: 'run-1',
    status: 'queued',
    trigger: 'manual',
    startedAt: Date.now(),
    projectId: 'proj-run',
    conversationId: 'conv-run',
    agentRunId: 'agent-run-1',
  };
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
