import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from '@playwright/test';
import type { FrameLocator, Locator, Page } from '@playwright/test';

import { seedVelaLoginConfig, writeFakeVelaBin } from '@/amr';
import { routeAgents, STORAGE_KEY } from '@/playwright/mock-factory';

export { STORAGE_KEY };

const ACTIVE_ARTIFACT_PREVIEW_SELECTOR =
  '[data-testid="artifact-preview-frame"]:visible, [data-testid="artifact-preview-frame-url-load"]:visible, [data-testid="artifact-preview-frame-srcdoc"]:visible, [data-testid="live-artifact-preview-frame"]:visible';

type AgentChoice = {
  readonly model: string;
  readonly reasoning: string;
};

type AgentConfig = {
  readonly mode: 'daemon';
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly agentId: 'amr' | 'codex';
  readonly skillId: null;
  readonly designSystemId: null;
  readonly onboardingCompleted: boolean;
  readonly mediaProviders: Record<string, never>;
  readonly agentModels: Record<'amr' | 'codex', AgentChoice>;
  readonly agentCliEnv: {
    readonly amr: Record<string, string>;
    readonly codex: Record<string, string>;
  };
};

export type AmrWorkspaceOptions = {
  readonly codexEnv: Record<string, string>;
  readonly failAuthAtPrompt?: boolean;
  readonly failBalanceAtPrompt?: boolean;
  readonly profile?: string;
  readonly requireLoginConfig?: boolean;
  readonly selectedAgentId: 'amr' | 'codex';
  readonly seedLoginConfig?: boolean;
  readonly assistantText?: string;
};

export function artifactPreview(page: Page): Locator {
  return page.locator(ACTIVE_ARTIFACT_PREVIEW_SELECTOR).first();
}

export function artifactPreviewFrame(page: Page): FrameLocator {
  return page.frameLocator(ACTIVE_ARTIFACT_PREVIEW_SELECTOR);
}

export async function setupAmrWorkspace(
  page: Page,
  options: AmrWorkspaceOptions,
) {
  const root = join(
    tmpdir(),
    `open-design-amr-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const homeDir = join(root, 'home');
  const velaBin = await writeFakeVelaBin(join(root, 'bin'), {
    ...(options.assistantText !== undefined ? { assistantText: options.assistantText } : {}),
    ...(options.failAuthAtPrompt !== undefined ? { failAuthAtPrompt: options.failAuthAtPrompt } : {}),
    ...(options.failBalanceAtPrompt !== undefined ? { failBalanceAtPrompt: options.failBalanceAtPrompt } : {}),
    ...(options.requireLoginConfig !== undefined ? { requireLoginConfig: options.requireLoginConfig } : {}),
  });
  await mkdir(homeDir, { recursive: true });
  if (options.seedLoginConfig !== false) {
    await seedVelaLoginConfig(homeDir, {
      email: 'ui-amr@example.com',
      profile: options.profile ?? 'local',
    });
  }

  const config: AgentConfig = {
    mode: 'daemon',
    apiKey: '',
    baseUrl: '',
    model: '',
    agentId: options.selectedAgentId,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {
      amr: { model: 'default', reasoning: 'default' },
      codex: { model: 'default', reasoning: 'default' },
    },
    agentCliEnv: {
      amr: {
        VELA_BIN: velaBin,
        HOME: homeDir,
        VELA_LINK_URL: 'http://localhost:18081',
        VELA_RUNTIME_KEY: 'fake-runtime-key',
        ...(options.profile ? { OPEN_DESIGN_AMR_PROFILE: options.profile } : {}),
      },
      codex: options.codexEnv,
    },
  };

  await routeAgents(page, [
    {
      id: 'amr',
      name: 'AMR (vela)',
      bin: 'vela',
      available: true,
      version: '1.0.0',
      models: [{ id: 'default', label: 'Default' }],
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      bin: 'codex',
      available: true,
      version: 'test',
      models: [{ id: 'default', label: 'Default' }],
    },
  ]);
  await seedBrowserConfig(page, config);
  await putAppConfig(page, config);

  const projectId = `amr-ui-${Date.now()}`.replace(/[^A-Za-z0-9._-]/g, '-');
  await createProjectViaApi(page, projectId, 'AMR UI failure smoke');
  return { homeDir, projectId, root, velaBin };
}

export async function expectStoredAgent(page: Page, agentId: 'amr' | 'codex'): Promise<void> {
  await expect
    .poll(async () => {
      const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && 'agentId' in parsed
        ? parsed.agentId
        : null;
    }, { timeout: 10_000 })
    .toBe(agentId);
  await expect
    .poll(async () => {
      const response = await page.request.get('/api/app-config');
      if (!response.ok()) return null;
      const body = await response.json();
      if (typeof body !== 'object' || body === null || !('config' in body)) return null;
      const config = body.config;
      return typeof config === 'object' && config !== null && 'agentId' in config
        ? config.agentId
        : null;
    }, { timeout: 10_000 })
    .toBe(agentId);
}

export async function waitForLoadingToClear(page: Page): Promise<void> {
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 15_000 });
}

export async function dismissPrivacyDialog(page: Page): Promise<void> {
  const privacyRegion = page.getByRole('region', { name: /Help us improve Open Design/i });
  if (await privacyRegion.isVisible()) {
    await privacyRegion.getByRole('button', { name: /not now|i get it|got it/i }).click();
    await expect(privacyRegion).toBeHidden();
  }
}

export async function expectWorkspaceReady(page: Page): Promise<void> {
  await waitForLoadingToClear(page);
  await expect(page).toHaveURL(/\/projects\//);
  await expect(page.getByTestId('chat-composer')).toBeVisible();
  await expect(page.getByTestId('chat-composer-input')).toBeVisible();
}

export async function openSettingsDialog(page: Page): Promise<Locator> {
  await waitForLoadingToClear(page);
  await dismissPrivacyDialog(page);
  const settingsTrigger = page.getByTestId('entry-settings-menu-trigger');
  if (await settingsTrigger.isVisible({ timeout: 1_000 })) {
    await settingsTrigger.click();
  } else {
    await page.getByRole('button', { name: /Open settings|打开设置|開啟設定|Account & settings/i }).first().click();
  }
  const dialog = page.getByRole('dialog');
  const menu = page
    .getByTestId('entry-settings-menu')
    .or(page.getByRole('menu'))
    .first();
  await expect
    .poll(async () => {
      if (await dialog.isVisible()) return 'dialog';
      if (await menu.isVisible()) return 'menu';
      return 'pending';
    })
    .not.toBe('pending');
  if (await menu.isVisible()) {
    const settingsItem = menu
      .getByRole('menuitem', { name: /Settings|设置|設定/i })
      .or(menu.getByRole('button', { name: /Settings|设置|設定/i }))
      .first();
    await expect(settingsItem).toBeVisible({ timeout: 10_000 });
    await settingsItem.click();
  }
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

export async function sendPrompt(page: Page, prompt: string): Promise<void> {
  const input = page.getByTestId('chat-composer-input');
  const sendButton = page.getByTestId('chat-send');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.click();
  await input.fill(prompt);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
}

export async function createProjectViaApi(
  page: Page,
  projectId: string,
  name: string,
): Promise<{ readonly conversationId: string }> {
  const response = await page.request.post('/api/projects', {
    data: {
      id: projectId,
      name,
      skillId: null,
      designSystemId: null,
      pendingPrompt: null,
      metadata: { kind: 'prototype' },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body: unknown = await response.json();
  if (!isConversationCreateResponse(body)) {
    throw new Error(`unexpected create project response for ${projectId}`);
  }
  return body;
}

export async function gotoProject(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}`, { waitUntil: 'domcontentloaded' });
  await dismissPrivacyDialog(page);
  await expectWorkspaceReady(page);
}

export async function putAppConfig(page: Page, config: Record<string, unknown>): Promise<void> {
  const response = await page.request.put('/api/app-config', { data: config });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function seedBrowserConfig(page: Page, value: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ key, config }: { readonly key: string; readonly config: Record<string, unknown> }) => {
      window.localStorage.setItem(key, JSON.stringify(config));
    },
    { key: STORAGE_KEY, config: value },
  );
}

function isConversationCreateResponse(
  value: unknown,
): value is { readonly conversationId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'conversationId' in value &&
    typeof value.conversationId === 'string'
  );
}
