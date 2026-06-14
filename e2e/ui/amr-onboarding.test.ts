import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { fulfillAgentsRoute } from '@/playwright/mock-factory';

const STORAGE_KEY = 'open-design:config';

type OnboardingConfig = {
  mode: 'daemon';
  apiKey: string;
  baseUrl: string;
  model: string;
  agentId: string | null;
  skillId: null;
  designSystemId: null;
  onboardingCompleted: boolean;
  mediaProviders: Record<string, never>;
  agentModels: Record<string, { model: string; reasoning: string }>;
};

declare global {
  interface Window {
    __amrOnboardingLoginCalls?: number;
    __amrOnboardingStatusCalls?: number;
  }
}

test.describe.configure({ timeout: 30_000 });

test('[P0] @critical onboarding lets AMR Cloud sign in and complete setup after the login poll succeeds', async ({
  page,
}) => {
  const config = await wireOnboardingMocks(page, {
    amrAvailable: true,
    initialLoggedIn: false,
  });

  await seedOnboardingConfig(page, config);
  await gotoOnboarding(page);

  const continueButton = page.getByRole('button', { name: /sign in to continue/i });
  await expect(continueButton).toBeVisible();
  await continueButton.click();

  await expect.poll(() => page.evaluate(() => window.__amrOnboardingLoginCalls ?? 0)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__amrOnboardingStatusCalls ?? 0))
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: /^Continue$/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^Continue$/i }).click();
  await finishOnboardingFromDesignSystemStep(page);
  await pollStoredConfig(page).toMatchObject({
    agentId: 'amr',
    onboardingCompleted: true,
  });
});

test('[P0] @critical onboarding Local CLI card lets the user pick an agent model before continuing', async ({
  page,
}) => {
  const config = await wireOnboardingMocks(page, {
    amrAvailable: false,
    initialLoggedIn: false,
    codexModels: [
      { id: 'gpt-5.4-mini', label: 'gpt-5.4-mini' },
      { id: 'gpt-5.5', label: 'gpt-5.5' },
      { id: 'o3', label: 'o3' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { id: 'glm-5', label: 'GLM 5' },
      { id: 'qwen3-235b', label: 'Qwen3 235B' },
      { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6' },
    ],
  });

  await seedOnboardingConfig(page, config);
  await gotoOnboarding(page);

  await page.getByRole('button', { name: /Local coding agent/i }).click();
  await selectOnboardingOption(page, 'Model', 'GLM 5');

  await expect(expectOnboardingTrigger(page, 'Model')).toContainText('GLM 5');
  await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();
});

test('[P0] @critical onboarding BYOK path can fetch models, test the provider, and complete setup', async ({
  page,
}) => {
  const config = await wireOnboardingMocks(page, {
    amrAvailable: true,
    initialLoggedIn: true,
  });

  await page.route('**/api/provider/models', async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        kind: 'success',
        latencyMs: 14,
        models: [
          { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
          { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
        ],
      },
    });
  });
  await page.route('**/api/test/connection', async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        kind: 'success',
        latencyMs: 27,
        model: 'claude-opus-4-8',
        sample: 'Connected',
      },
    });
  });

  await seedOnboardingConfig(page, config);
  await gotoOnboarding(page);

  await page.getByRole('button', { name: /Bring your own key/i }).click();
  await expect(page.getByText('BYOK')).toBeVisible();
  const byokPanel = page.locator('.onboarding-view__setup-panel').filter({ hasText: /BYOK/ });

  await fillInlineField(page, 'API key', 'test-api-key');
  await fillInlineField(page, 'Base URL', 'https://api.anthropic.com');
  await page.getByRole('button', { name: /Fetch models/i }).click();
  await expect(page.getByRole('status')).toContainText('Fetched 2 models.');
  await selectOnboardingOption(byokPanel, 'Model', 'claude-opus-4-8');

  await page.getByRole('button', { name: /^Test$/i }).click();
  await expect(page.getByText('Connected. Replied in 27 ms')).toBeVisible();

  await page.getByRole('button', { name: /^Continue$/i }).click();
  await expect(page.getByText(/Optional details for better defaults/i)).toBeVisible();
  await page.getByRole('button', { name: /^Continue$/i }).click();
  await finishOnboardingFromDesignSystemStep(page);
  await pollStoredConfig(page).toMatchObject({
    mode: 'api',
    apiKey: 'test-api-key',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-opus-4-8',
    onboardingCompleted: true,
  });
});

async function wireOnboardingMocks(
  page: Page,
  options: {
    amrAvailable: boolean;
    initialLoggedIn: boolean;
    amrModels?: Array<{ id: string; label: string }>;
    codexModels?: Array<{ id: string; label: string }>;
  },
): Promise<OnboardingConfig> {
  const config: OnboardingConfig = {
    mode: 'daemon',
    apiKey: '',
    baseUrl: '',
    model: '',
    agentId: options.amrAvailable ? 'amr' : 'codex',
    skillId: null,
    designSystemId: null,
    onboardingCompleted: false,
    mediaProviders: {},
    agentModels: options.amrAvailable
      ? { amr: { model: 'default', reasoning: 'default' } }
      : { codex: { model: 'default', reasoning: 'default' } },
  };

  let loggedIn = options.initialLoggedIn;
  let loginInFlight = false;
  let statusCalls = 0;
  let loginCalls = 0;

  await page.route('**/api/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { projects: [] } });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/app-config', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { config } });
      return;
    }
    if (route.request().method() === 'PUT') {
      Object.assign(config, route.request().postDataJSON() as Partial<OnboardingConfig>);
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.continue();
  });

  const agents = [
    ...(options.amrAvailable
      ? [
          {
            id: 'amr',
            name: 'AMR (vela)',
            bin: 'vela',
            available: true,
            version: '1.0.0',
            models: options.amrModels ?? [{ id: 'default', label: 'Default' }],
          },
        ]
      : []),
    {
      id: 'codex',
      name: 'Codex CLI',
      bin: 'codex',
      available: true,
      version: 'test',
      models: options.codexModels ?? [{ id: 'default', label: 'Default' }],
    },
  ];

  await page.route('**/api/agents**', async (route) => {
    await fulfillAgentsRoute(route, agents);
  });

  await page.route('**/api/integrations/vela/status', async (route) => {
    statusCalls += 1;
    await page.evaluate((calls) => {
      window.__amrOnboardingStatusCalls = calls;
    }, statusCalls);
    await route.fulfill({
      json: loggedIn
        ? {
            loggedIn: true,
            loginInFlight: false,
            profile: 'local',
            configPath: '/tmp/.amr/config.json',
            user: { id: 'user-1', email: 'onboarding@example.com', plan: 'free' },
          }
        : {
            loggedIn: false,
            loginInFlight,
            profile: 'local',
            configPath: '/tmp/.amr/config.json',
            user: null,
          },
    });
  });

  await page.route('**/api/integrations/vela/login', async (route) => {
    loginCalls += 1;
    loginInFlight = true;
    loggedIn = true;
    loginInFlight = false;
    await page.evaluate((calls) => {
      window.__amrOnboardingLoginCalls = calls;
    }, loginCalls);
    await route.fulfill({
      status: 202,
      json: { pid: 4242, startedAt: new Date().toISOString(), profile: 'local' },
    });
  });

  return config;
}

async function gotoOnboarding(page: Page) {
  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  await waitForLoadingToClear(page);
  await dismissPrivacyDialog(page);
  await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
}

async function waitForLoadingToClear(page: Page) {
  await expect(page.getByText(/Loading Open Design/)).toHaveCount(0, { timeout: 15_000 });
}

async function dismissPrivacyDialog(page: Page) {
  const privacyRegion = page.getByRole('region', { name: /Help us improve Open Design/i });
  if (await privacyRegion.isVisible().catch(() => false)) {
    await privacyRegion.getByRole('button', { name: /not now|i get it|got it/i }).click();
    await expect(privacyRegion).toBeHidden();
  }
}

async function seedOnboardingConfig(page: Page, config: OnboardingConfig) {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: config },
  );
}

async function finishOnboardingFromDesignSystemStep(page: Page) {
  const newsletterStep = page.getByRole('heading', { name: /Stay in the loop/i });
  if (await newsletterStep.count()) {
    await expect(newsletterStep).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^Continue$/i }).click();
  }
  const designSystemStep = page.locator('.onboarding-view__ds-intro');
  await expect(designSystemStep).toBeVisible({ timeout: 10_000 });
  await designSystemStep.getByRole('button', { name: /Skip for now/i }).click();
  await expect(page).not.toHaveURL(/\/onboarding$/);
  await expect(page.getByText('What do you want to design?')).toBeVisible();
}

function pollStoredConfig(page: Page) {
  return expect.poll(() =>
    page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), STORAGE_KEY),
  );
}

type OnboardingLocatorRoot = Page | Locator;

function onboardingField(root: OnboardingLocatorRoot, label: string) {
  return root.locator('.onboarding-view__select-field, .onboarding-view__inline-field').filter({
    hasText: new RegExp(label, 'i'),
  }).first();
}

function expectOnboardingTrigger(root: OnboardingLocatorRoot, label: string) {
  return onboardingField(root, label).getByRole('button');
}

async function selectOnboardingOption(root: OnboardingLocatorRoot, label: string, option: string) {
  const field = onboardingField(root, label);
  const listbox = field.getByRole('listbox', { name: new RegExp(label, 'i') });
  if (!(await listbox.isVisible().catch(() => false))) {
    await field.getByRole('button').click();
  }
  await listbox.getByRole('option').filter({ hasText: new RegExp(option, 'i') }).first().click();
}

async function fillInlineField(page: Page, label: string, value: string) {
  await onboardingField(page, label).locator('input').fill(value);
}
