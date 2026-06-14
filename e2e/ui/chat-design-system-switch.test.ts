import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

import { createProjectViaApi, gotoProject, sendPrompt } from '@/playwright/amr';
import { applyStandardMocks } from '@/playwright/mock-factory';

const EDITORIAL_SYSTEM = {
  id: 'editorial',
  title: 'Editorial System',
  category: 'Publishing',
  summary: 'Editorial layouts with expressive typography.',
  swatches: ['#111827', '#f97316'],
} as const;

test.describe.configure({ timeout: 30_000 });

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
  await routeDesignSystems(page);
});

test('[P1] composer import menu switches the active design system before sending', async ({ page }) => {
  const projectId = `composer-ds-${randomUUID()}`;
  await createProjectViaApi(page, projectId, 'Composer DS switch');
  await routeRuns(page);
  await gotoProject(page, projectId);

  await openImportDesignSystems(page);
  await page.getByTestId('composer-ds-picker-search').fill('editorial');
  await page.getByTestId('composer-ds-picker-item-editorial').click();
  await expect(page.getByTestId('composer-ds-picker')).toHaveCount(0);

  const projectResponse = await page.request.get(`/api/projects/${projectId}`);
  expect(projectResponse.ok(), await projectResponse.text()).toBeTruthy();
  const projectBody: unknown = await projectResponse.json();
  if (!hasProjectDesignSystem(projectBody, EDITORIAL_SYSTEM.id)) {
    throw new Error(`project ${projectId} did not persist the editorial design system`);
  }

  const runRequestPromise = page.waitForRequest(isRunRequest);
  await sendPrompt(page, 'Use the selected design system.');
  const runRequest = await runRequestPromise;
  const runBody: unknown = runRequest.postDataJSON();
  if (!hasRunDesignSystem(runBody, EDITORIAL_SYSTEM.id)) {
    throw new Error('run payload did not include the editorial design system');
  }
});

async function openImportDesignSystems(page: Page): Promise<void> {
  await page.getByTestId('composer-tools-trigger').click();
  await page.getByTestId('composer-tools-tab-import').click();
  await page.getByTestId('composer-import-design-systems').click();
  await expect(page.getByTestId('composer-ds-picker')).toBeVisible();
}

async function routeDesignSystems(page: Page): Promise<void> {
  await page.route('**/api/design-systems', async (route) => {
    await route.fulfill({ json: { designSystems: [EDITORIAL_SYSTEM] } });
  });
}

async function routeRuns(page: Page): Promise<void> {
  await page.route('**/api/runs', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 202, json: { runId: 'composer-ds-run' } });
  });
  await page.route('**/api/runs/*/events', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: done\ndata: {}\n\n',
    });
  });
}

function isRunRequest(request: Request): boolean {
  return new URL(request.url()).pathname === '/api/runs' && request.method() === 'POST';
}

function hasProjectDesignSystem(
  body: unknown,
  designSystemId: string,
): body is { readonly project: { readonly designSystemId: string } } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'project' in body &&
    hasDesignSystemId(body.project, designSystemId)
  );
}

function hasRunDesignSystem(
  body: unknown,
  designSystemId: string,
): body is { readonly designSystemId: string } {
  return hasDesignSystemId(body, designSystemId);
}

function hasDesignSystemId(
  body: unknown,
  designSystemId: string,
): body is { readonly designSystemId: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'designSystemId' in body &&
    body.designSystemId === designSystemId
  );
}
