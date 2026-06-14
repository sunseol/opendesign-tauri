import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { createProjectViaApi, gotoProject } from '@/playwright/amr';
import { applyStandardMocks } from '@/playwright/mock-factory';

type ComposerMetrics = {
  readonly inputLeftInset: number;
  readonly inputRightInset: number;
  readonly plusLeftInset: number;
  readonly rowBorderTop: string | null;
  readonly sendRightInset: number;
};

test.describe.configure({ timeout: 30_000 });

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
});

test('[P1] composer footer sits inset inside the card with no toolbar divider', async ({ page }) => {
  const projectId = `composer-footer-${randomUUID()}`;
  await createProjectViaApi(page, projectId, 'Composer footer card');
  await gotoProject(page, projectId);
  await expect(page.getByTestId('chat-send')).toBeVisible();

  const metrics = await page.evaluate<ComposerMetrics | { readonly error: string }>(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? element.getBoundingClientRect() : null;
    };
    const shell = rect('.composer-shell');
    const send = rect('.composer-row .composer-send');
    const plus = rect('.composer-row .icon-btn');
    const input = rect('.composer-input-wrap');
    const row = document.querySelector('.composer-row');
    if (!shell || !send || !plus || !input) return { error: 'missing composer parts' };
    return {
      inputLeftInset: input.left - shell.left,
      inputRightInset: shell.right - input.right,
      plusLeftInset: plus.left - shell.left,
      rowBorderTop: row ? getComputedStyle(row).borderTopWidth : null,
      sendRightInset: shell.right - send.right,
    };
  });

  if ('error' in metrics) throw new Error(metrics.error);

  expect(metrics.sendRightInset, JSON.stringify(metrics)).toBeGreaterThanOrEqual(5);
  expect(metrics.plusLeftInset, JSON.stringify(metrics)).toBeGreaterThanOrEqual(5);
  expect(Math.abs(metrics.inputLeftInset - metrics.inputRightInset), JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.inputLeftInset, JSON.stringify(metrics)).toBeGreaterThanOrEqual(5);
  expect(metrics.rowBorderTop, JSON.stringify(metrics)).toBe('0px');
});
