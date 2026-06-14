import { expect, test } from '@playwright/test';

import {
  clearActiveChip,
  gotoEntryHome,
  pickRailChip,
  routeHomeHeroRailMocks,
} from '@/playwright/home-hero-rail';

test.describe.configure({ timeout: 30_000 });

test.beforeEach(async ({ page }) => {
  await routeHomeHeroRailMocks(page);
});

test('[P2] home hero rail shows creation chips and More shortcuts', async ({ page }) => {
  await gotoEntryHome(page);

  await expect(page.getByTestId('entry-star-badge')).toContainText('51.6K');
  await expect(page.getByTestId('home-hero-type-tabs')).toBeVisible();
  for (const id of ['prototype', 'live-artifact', 'deck', 'image', 'video', 'hyperframes', 'audio']) {
    await expect(page.getByTestId(`home-hero-rail-${id}`)).toBeVisible();
  }

  await page.getByTestId('home-hero-shortcuts-trigger').click();
  const menu = page.getByTestId('home-hero-shortcuts-menu');
  await expect(menu).toBeVisible();
  for (const id of ['create-plugin', 'figma', 'template']) {
    await expect(menu.getByTestId(`home-hero-rail-${id}`)).toBeVisible();
  }
});

test('[P1] home hero rail switches create and media modes without pre-filling prompt', async ({ page }) => {
  await gotoEntryHome(page);

  const input = page.getByTestId('home-hero-input');
  await expect(input).toHaveText('');

  await pickRailChip(page, 'prototype');
  await expect(page.getByTestId('home-hero-footer-option-designSystem')).toBeVisible();
  await expect(page.getByTestId('home-hero-footer-option-fidelity')).toBeVisible();
  await expect(page.getByTestId('home-hero-footer-option-duration')).toHaveCount(0);
  await expect(input).toHaveText('');
  await clearActiveChip(page);

  await pickRailChip(page, 'video');
  await expect(page.getByTestId('home-hero-footer-option-ratio')).toBeVisible();
  await expect(page.getByTestId('home-hero-footer-option-resolution')).toBeVisible();
  await expect(page.getByTestId('home-hero-footer-option-duration')).toBeVisible();
  await expect(input).toHaveText('');
});

test('[P1] home hero preset cards seed the composer and clear without leaking state', async ({ page }) => {
  await gotoEntryHome(page);

  const input = page.getByTestId('home-hero-input');
  await pickRailChip(page, 'prototype');
  await expect(page.getByTestId('home-hero-plugin-presets')).toBeVisible();
  await page
    .locator('[data-testid="home-hero-plugin-preset"][data-plugin-id="example-web-prototype"]')
    .click();
  await expect(input).toHaveText(
    'Build a high-fidelity web prototype for product evaluators using the active project design system from the bundled web prototype seed.',
  );

  await clearActiveChip(page);
  await expect(page.getByTestId('home-hero-plugin-presets')).toHaveCount(0);
  await expect(page.getByTestId('home-hero-footer-option-designSystem')).toHaveCount(0);

  await pickRailChip(page, 'deck');
  await expect(page.getByTestId('home-hero-plugin-presets')).toBeVisible();
  await page
    .locator('[data-testid="home-hero-plugin-preset"][data-plugin-id="example-simple-deck"]')
    .click();
  await expect(input).toHaveText(
    'Create a pitch deck for decision makers about quarterly review with 10-15 pages. Speaker notes: include speaker notes. Use the active project design system.',
  );
});
