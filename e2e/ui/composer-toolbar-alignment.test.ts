import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const STORAGE_KEY = 'open-design:config';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
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
      }),
    );
  }, STORAGE_KEY);

  await page.route('**/api/app-config', async (route) => {
    await route.fulfill({
      json: {
        config: {
          onboardingCompleted: true,
          agentId: 'mock',
          skillId: null,
          designSystemId: null,
          agentModels: {},
          agentCliEnv: {},
          privacyDecisionAt: 1,
          telemetry: { metrics: false, content: false, artifactManifest: false },
        },
      },
    });
  });

  await page.route('**/api/agents', async (route) => {
    await route.fulfill({
      json: {
        agents: [
          {
            id: 'mock',
            name: 'Mock Agent',
            bin: 'mock-agent',
            available: true,
            version: 'test',
            models: [{ id: 'default', label: 'Default' }],
          },
        ],
      },
    });
  });
});

test('[P1] composer footer controls share one height and baseline', async ({ page }) => {
  await page.goto('/');
  await createProject(page, 'Composer toolbar alignment');
  await expect(page).toHaveURL(/\/projects\//);
  await expect(page.getByTestId('chat-composer')).toBeVisible();
  await expect(page.getByTestId('chat-send')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const row = document.querySelector('.composer-row');
    if (!row) return { error: 'no .composer-row' as const };

    const controls = Array.from(row.querySelectorAll<HTMLButtonElement>('button'))
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
          height: rect.height,
          width: rect.width,
          center: rect.top + rect.height / 2,
        };
      })
      .filter((control) => control.height > 0 && control.width > 0);

    return { controls };
  });

  if ('error' in metrics) throw new Error(metrics.error);

  const { controls } = metrics;
  expect(controls.length, `composer controls: ${JSON.stringify(controls)}`).toBeGreaterThanOrEqual(3);

  const heights = controls.map((control) => control.height);
  const centers = controls.map((control) => control.center);

  expect(spread(heights), `control heights: ${JSON.stringify(controls)}`).toBeLessThanOrEqual(1);
  expect(spread(centers), `control centers: ${JSON.stringify(controls)}`).toBeLessThanOrEqual(1);
});

function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

async function createProject(page: Page, projectName: string): Promise<void> {
  const response = await page.request.post('/api/projects', {
    data: {
      id: randomUUID(),
      name: projectName,
      skillId: null,
      designSystemId: null,
      metadata: { kind: 'prototype', nameSource: 'user' },
    },
  });
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    readonly project: { readonly id: string };
    readonly conversationId: string;
  };
  await page.goto(`/projects/${body.project.id}/conversations/${body.conversationId}`);
}
