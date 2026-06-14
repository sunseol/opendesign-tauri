import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { createFakeAgentRuntimes } from '@/playwright/fake-agents';
import {
  artifactPreview,
  artifactPreviewFrame,
  expectStoredAgent,
  gotoProject,
  openSettingsDialog,
  sendPrompt,
  setupAmrWorkspace,
} from '@/playwright/amr';

let codexRuntime: Awaited<ReturnType<typeof createFakeAgentRuntimes>>['codex'];

declare global {
  interface Window {
    __amrFailureOpenedUrls?: string[];
    __amrFailureLoginCalls?: number;
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const runtimes = await createFakeAgentRuntimes(['codex']);
  codexRuntime = runtimes.codex;
});

test('[P0] @critical AMR insufficient-balance failures surface recharge and keep Retry available', async ({
  page,
}) => {
  await routeVelaStatus(page, true);
  await captureOpenedUrls(page);
  const workspace = await setupAmrWorkspace(page, {
    codexEnv: codexRuntime.env,
    failBalanceAtPrompt: true,
    requireLoginConfig: false,
    selectedAgentId: 'amr',
  });

  await gotoProject(page, workspace.projectId);
  await sendPrompt(page, 'AMR insufficient balance recovery smoke');

  const recharge = page.getByRole('button', { name: /Recharge AMR|AMR 충전/i }).first();
  await expect(recharge).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Retry$|^다시 시도$/i }).first()).toBeVisible();

  await recharge.click();

  await expect
    .poll(() => page.evaluate(() => window.__amrFailureOpenedUrls ?? []))
    .toContainEqual(
      expect.stringMatching(
        /^https:\/\/open-design\.ai\/amr\/wallet\?.*source=open_design.*od_origin=open_design.*od_entry_source=chat_error_recharge/,
      ),
    );
});

test('[P0] @critical AMR auth failures offer sign-in recovery and call the login endpoint', async ({
  page,
}) => {
  await routeVelaLogin(page);
  const workspace = await setupAmrWorkspace(page, {
    codexEnv: codexRuntime.env,
    failAuthAtPrompt: true,
    selectedAgentId: 'amr',
  });

  await gotoProject(page, workspace.projectId);
  await sendPrompt(page, 'AMR auth failure recovery smoke');

  const signIn = page.getByRole('button', { name: /Sign in to AMR|AMR 로그인/i }).first();
  await expect(signIn).toBeVisible({ timeout: 15_000 });
  await signIn.click();

  await expect.poll(() => page.evaluate(() => window.__amrFailureLoginCalls ?? 0)).toBe(1);
});

test('[P0] after an AMR failure the user can switch to Codex and complete a fresh run', async ({
  page,
}) => {
  await routeVelaStatus(page, false);
  const workspace = await setupAmrWorkspace(page, {
    codexEnv: codexRuntime.env,
    failAuthAtPrompt: true,
    selectedAgentId: 'amr',
  });

  await gotoProject(page, workspace.projectId);
  await sendPrompt(page, 'AMR auth failure before switch smoke');
  await expect(page.locator('.msg.error')).toContainText(/AMR sign-in is required|AMR 로그인이 필요합니다/i, {
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: /Sign in to AMR|AMR 로그인/i }).first()).toBeVisible();

  const settings = await openSettingsDialog(page);
  await settings.getByRole('button', { name: /Codex CLI/i }).click();
  await expectStoredAgent(page, 'codex');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await sendPrompt(page, 'Create a deterministic smoke artifact');
  await expect(artifactPreview(page)).toBeVisible({ timeout: 20_000 });
  await expect(
    artifactPreviewFrame(page).getByRole('heading', {
      name: 'Real Daemon Smoke',
    }),
  ).toBeVisible();
});

async function routeVelaStatus(page: Page, loggedIn: boolean): Promise<void> {
  await page.route('**/api/integrations/vela/status', async (route) => {
    await route.fulfill({
      json: loggedIn
        ? {
            loggedIn: true,
            profile: 'local',
            configPath: '/tmp/.amr/config.json',
            user: { id: 'amr-user', email: 'amr-ui@example.com', plan: 'free' },
          }
        : {
            loggedIn: false,
            profile: 'local',
            configPath: '/tmp/.amr/config.json',
            user: null,
          },
    });
  });
}

async function routeVelaLogin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__amrFailureLoginCalls = 0;
  });
  await page.route('**/api/integrations/vela/login', async (route) => {
    await page.evaluate(() => {
      window.__amrFailureLoginCalls = (window.__amrFailureLoginCalls ?? 0) + 1;
    });
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ pid: 4242, startedAt: new Date().toISOString(), profile: 'local' }),
    });
  });
}

async function captureOpenedUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__amrFailureOpenedUrls = [];
    const originalOpen = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => {
      const target = args[0];
      if (typeof target === 'string') {
        window.__amrFailureOpenedUrls?.push(target);
      }
      return originalOpen(...args);
    };
  });
}
