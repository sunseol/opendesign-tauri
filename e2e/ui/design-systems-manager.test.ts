import { expect, test } from '@playwright/test';
import {
  baseConfig,
  gotoEntryHome,
  routeDesignSystemsManager,
  seedEntryBase,
} from '@/playwright/design-systems-manager';
import type { UserSystem } from '@/playwright/design-systems-manager';

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

test('[P1] filtering user systems preserves delete fallback for the default system', async ({ page }) => {
  await seedEntryBase(page, baseConfig({ designSystemId: 'brand-alpha' }));
  const systems: UserSystem[] = [
    {
      id: 'brand-alpha',
      title: 'Brand Alpha',
      category: 'Productivity & SaaS',
      summary: 'Published default system.',
      surface: 'web',
      source: 'user',
      status: 'published',
      updatedAt: '2026-05-28T01:00:00.000Z',
    },
    {
      id: 'brand-beta',
      title: 'Brand Beta',
      category: 'Productivity & SaaS',
      summary: 'Fallback published system.',
      surface: 'web',
      source: 'user',
      status: 'published',
      updatedAt: '2026-05-28T00:00:00.000Z',
    },
    {
      id: 'brand-gamma',
      title: 'Brand Gamma',
      category: 'Productivity & SaaS',
      summary: 'Draft internal design system.',
      surface: 'web',
      source: 'user',
      status: 'draft',
      updatedAt: '2026-05-27T00:00:00.000Z',
    },
  ];
  const { deletedDesignSystemIds, persistedDesignSystemIds } = await routeDesignSystemsManager(page, systems, {
    initialConfig: baseConfig({ designSystemId: 'brand-alpha' }),
  });

  page.on('dialog', (dialog) => void dialog.accept());
  await gotoEntryHome(page);
  await page.getByTestId('entry-nav-design-systems').click();

  const manager = page.locator('section[aria-label="Design Systems"]');
  await manager.getByLabel('Filter design systems').selectOption('draft');
  await expect(manager.locator('.ds-user-row')).toHaveCount(1);
  await expect(manager.locator('.ds-user-row')).toContainText('Brand Gamma');

  await manager.getByLabel('Filter design systems').selectOption('all');
  await manager.locator('.ds-user-row').filter({ hasText: 'Brand Alpha' }).getByLabel('Delete Brand Alpha').click();

  await expect.poll(() => deletedDesignSystemIds).toContainEqual('brand-alpha');
  await expect.poll(() => persistedDesignSystemIds.at(-1)).toBe('brand-beta');
  await expect(manager.locator('.ds-user-row').filter({ hasText: 'Brand Alpha' })).toHaveCount(0);
  await expect(manager.locator('.ds-user-row').filter({ hasText: 'Brand Beta' }).getByText('Default')).toBeVisible();
});
