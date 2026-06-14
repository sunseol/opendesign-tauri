import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(resolve(testDir, '../../src/index.css'), 'utf8');

function cssDeclarations(css: string, selector: string): string {
  const blocks: string[] = [];
  const rulePattern = /([^{}]+)\{([^}]*)\}/g;
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(cssWithoutComments)) != null) {
    const selectors = (match[1] ?? '').split(',').map((item) => item.trim());
    if (selectors.includes(selector)) blocks.push(match[2] ?? '');
  }
  if (blocks.length === 0) throw new Error(`Missing CSS block for ${selector}`);
  return blocks.join('\n');
}

function ruleValue(block: string, property: string): string {
  const matches = [...block.matchAll(new RegExp(`(?:^|[;\\n])\\s*${property}:\\s*([^;]+);`, 'g'))];
  const value = matches.at(-1)?.[1];
  if (value == null) throw new Error(`Missing CSS property ${property}`);
  return value.trim();
}

function zIndex(css: string, selector: string): number {
  const value = Number.parseInt(ruleValue(cssDeclarations(css, selector), 'z-index'), 10);
  if (!Number.isFinite(value)) throw new Error(`Expected numeric z-index for ${selector}`);
  return value;
}

describe('Studio overlay layering', () => {
  it('keeps viewer modals above composer and workspace chrome layers', () => {
    const chromeLayer = zIndex(indexCss, '.workspace-tabs-chrome.app-chrome-header');
    const composerMenuLayer = zIndex(indexCss, '.app .working-dir-pill-menu');

    for (const selector of [
      '.ds-modal-backdrop',
      '.plugin-details-modal-backdrop',
      '.staged-preview-modal',
      '.qs-overlay',
    ]) {
      const layer = zIndex(indexCss, selector);
      expect(layer, selector).toBeGreaterThan(chromeLayer);
      expect(layer, selector).toBeGreaterThan(composerMenuLayer);
    }
  });

  it('keeps marker and inspector popovers above their preview overlays', () => {
    expect(zIndex(indexCss, '.comment-popover')).toBeGreaterThan(zIndex(indexCss, '.comment-overlay-layer'));
    expect(zIndex(indexCss, '.comment-popover')).toBeGreaterThan(zIndex(indexCss, '.comment-saved-pin'));
    expect(zIndex(indexCss, '.cc-color-popover')).toBeGreaterThan(zIndex(indexCss, '.comment-popover'));
  });
});
