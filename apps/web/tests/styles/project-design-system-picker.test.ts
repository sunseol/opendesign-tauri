import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexCss = readFileSync(resolve(__dirname, '../../src/index.css'), 'utf8');

function cssDeclarations(css: string, selector: string): string {
  const blocks: string[] = [];
  const rulePattern = /([^{}]+)\{([^}]*)\}/g;
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(cssWithoutComments)) !== null) {
    const selectors = (match[1] ?? '').split(',').map((item) => item.trim());
    if (selectors.includes(selector)) blocks.push(match[2] ?? '');
  }
  if (blocks.length === 0) throw new Error(`Missing CSS block for ${selector}`);
  return blocks.join('\n');
}

function ruleValue(block: string, property: string): string {
  const matches = [...block.matchAll(new RegExp(`(?:^|[;\\n])\\s*${property}:\\s*([^;]+);`, 'g'))];
  const match = matches.at(-1);
  if (!match) throw new Error(`Missing CSS property ${property}`);
  return match[1]!.trim();
}

function zIndex(css: string, selector: string): number {
  const value = Number.parseInt(ruleValue(cssDeclarations(css, selector), 'z-index'), 10);
  if (!Number.isFinite(value)) throw new Error(`Expected numeric z-index for ${selector}`);
  return value;
}

describe('ProjectDesignSystemPicker fullscreen styles', () => {
  it('keeps fullscreen design-system previews above app modal chrome', () => {
    const fullscreenLayer = zIndex(indexCss, '.project-ds-picker-fullscreen');

    expect(fullscreenLayer).toBeGreaterThan(zIndex(indexCss, '.ds-modal-backdrop'));
    expect(fullscreenLayer).toBeGreaterThan(zIndex(indexCss, '.prompt-template-lightbox-backdrop'));
  });
});
