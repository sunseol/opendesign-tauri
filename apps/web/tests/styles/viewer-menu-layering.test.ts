import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

function splitSelectors(rawSelectors: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < rawSelectors.length; index += 1) {
    const char = rawSelectors[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      selectors.push(rawSelectors.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(rawSelectors.slice(start).trim());
  return selectors.filter(Boolean);
}

function cssDeclarations(selector: string): string {
  const blocks: string[] = [];
  const rulePattern = /([^{}]+)\{([^}]*)\}/g;
  let match = rulePattern.exec(appCss);
  while (match !== null) {
    const rawSelectors = (match[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations = match[2] ?? '';
    if (splitSelectors(rawSelectors).includes(selector)) blocks.push(declarations);
    match = rulePattern.exec(appCss);
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

describe('viewer menu layering styles', () => {
  it('keeps viewer share and present menus above clipped workspace chrome', () => {
    for (const selector of [
      '.workspace:has(.share-menu-popover, .present-menu)',
      '.viewer:has(.share-menu-popover, .present-menu)',
    ]) {
      const block = cssDeclarations(selector);
      expect(ruleValue(block, 'position'), selector).toBe('relative');
      expect(ruleValue(block, 'z-index'), selector).toBe('220');
      expect(ruleValue(block, 'overflow'), selector).toBe('visible');
    }

    for (const selector of ['.present-wrap', '.share-menu']) {
      expect(ruleValue(cssDeclarations(selector), '--viewer-action-menu-z'), selector).toBe('220');
    }

    expect(ruleValue(cssDeclarations('.present-menu'), 'z-index')).toBe('var(--viewer-action-menu-z)');
    expect(ruleValue(cssDeclarations('.share-menu-popover'), 'z-index')).toBe('var(--viewer-action-menu-z)');
  });

  it('clips live artifact badges before they overlap adjacent tabs', () => {
    expect(ruleValue(cssDeclarations('.ws-tab.live-artifact-tab .ws-tab-text'), 'flex-shrink')).toBe('100');

    const badges = cssDeclarations('.ws-live-artifact-badges');
    expect(ruleValue(badges, 'flex')).toBe('0 1 auto');
    expect(ruleValue(badges, 'min-width')).toBe('0');
    expect(ruleValue(badges, 'overflow')).toBe('hidden');
  });
});
