import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { applyStandardMocks } from '@/playwright/mock-factory';

test.describe.configure({ timeout: 30_000 });

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
});

test('[P0] @critical home loads with the primary entry controls', async ({ page }) => {
  await gotoEntryHome(page);

  const primaryNav = page.getByRole('navigation', { name: 'Primary' });
  await expect(primaryNav).toBeVisible();
  await expect(primaryNav.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(primaryNav.getByRole('button', { name: 'New project' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Describe what you want to generate…' })).toBeVisible();
});

test('[P0] @critical settings dialog is reachable from home', async ({ page }) => {
  await gotoEntryHome(page);

  await page.getByRole('button', { name: 'Open settings' }).click();
  const settingsDialog = page.getByRole('dialog');
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByRole('heading', { name: 'Execution mode' })).toBeVisible();
});

test('[P0] @critical prototype project creation reaches the workspace shell', async ({ page }) => {
  await gotoEntryHome(page);
  await openNewProjectModal(page);
  await page.getByTestId('new-project-tab-prototype').click();
  await page.getByTestId('new-project-name').fill('Critical smoke project');
  await page.getByTestId('create-project').click();

  await expectWorkspaceReady(page);
});

async function gotoEntryHome(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForLoadingToClear(page);
  const privacyDialog = page.getByRole('dialog').filter({ hasText: 'Help us improve Open Design' });
  if (await privacyDialog.isVisible()) {
    await privacyDialog.getByRole('button', { name: /I get it|not now|got it|don't share/i }).click();
    await expect(privacyDialog).toHaveCount(0);
  }
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await expect(page.getByTestId('home-hero-input')).toBeVisible();
}

async function openNewProjectModal(page: Page) {
  await page.getByRole('button', { name: 'New project' }).click();
  await expect(page.getByTestId('new-project-modal')).toBeVisible();
  await expect(page.getByTestId('new-project-panel')).toBeVisible();
}

async function expectWorkspaceReady(page: Page) {
  await waitForLoadingToClear(page);
  await expect(page).toHaveURL(/\/projects\//);
  await expect(page.getByTestId('chat-composer')).toBeVisible();
  await expect(page.getByTestId('chat-composer-input')).toBeVisible();
  await expect(page.getByTestId('file-workspace')).toBeVisible();
}

async function waitForLoadingToClear(page: Page) {
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 10_000 });
}
