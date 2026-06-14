import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const homeHeroCss = readFileSync(new URL('../../src/styles/home/home-hero.css', import.meta.url), 'utf8');

function cssDeclarations(selector: string): string {
  const blocks: string[] = [];
  const rulePattern = /([^{}]+)\{([^}]*)\}/g;
  let match = rulePattern.exec(homeHeroCss);
  while (match !== null) {
    const rawSelectors = match[1] ?? '';
    const declarations = match[2] ?? '';
    const selectors = rawSelectors.split(',').map((item) => item.trim());
    if (selectors.includes(selector)) blocks.push(declarations);
    match = rulePattern.exec(homeHeroCss);
  }
  if (blocks.length === 0) throw new Error(`Missing CSS block for ${selector}`);
  return blocks.join('\n');
}

function ruleValue(block: string, property: string): string {
  const matches = Array.from(
    block.matchAll(new RegExp(`(?:^|[;\\n])\\s*${property}:\\s*([^;]+);`, 'g')),
  );
  const match = matches.at(-1);
  if (!match) throw new Error(`Missing CSS property ${property}`);
  const value = match[1];
  if (value === undefined) throw new Error(`Missing CSS value for ${property}`);
  return value.trim();
}

describe('HomeHero footer select theme styles', () => {
  it('uses theme-aware dropdown backgrounds instead of light-only white panels', () => {
    for (const selector of [
      '.home-hero__footer-select-menu',
      '.home-hero__footer-select-search',
      '.home-hero__footer-select-search input',
      '.home-hero__footer-select-search input:focus',
    ]) {
      const background = ruleValue(cssDeclarations(selector), 'background');
      expect(background, selector).not.toBe('#fff');
      expect(background, selector).toMatch(/var\(--bg-panel\)/);
    }
  });

  it('inverts monochrome model logos in dark dropdown panels', () => {
    for (const icon of ['openai', 'dalle', 'grok', 'elevenlabs', 'suno']) {
      const selector = `[data-theme="dark"] .home-hero__model-option-icon--${icon} img`;
      expect(ruleValue(cssDeclarations(selector), 'filter'), selector).toBe(
        'invert(1) brightness(1.2)',
      );
      expect(homeHeroCss).toContain(
        `html:not([data-theme="light"]) .home-hero__model-option-icon--${icon} img`,
      );
    }
  });
});
