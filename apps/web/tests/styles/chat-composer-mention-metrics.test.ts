import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

function cssDeclarations(selector: string): string {
  const blocks: string[] = [];
  const rulePattern = /([^{}]+)\{([^}]*)\}/g;
  const cssWithoutComments = appCss.replace(/\/\*[\s\S]*?\*\//g, '');
  let match = rulePattern.exec(cssWithoutComments);
  while (match !== null) {
    const selectors = (match[1] ?? '').split(',').map((item) => item.trim());
    if (selectors.includes(selector)) blocks.push(match[2] ?? '');
    match = rulePattern.exec(cssWithoutComments);
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

function optionalRuleValue(block: string, property: string): string | null {
  try {
    return ruleValue(block, property);
  } catch {
    return null;
  }
}

describe('ChatComposer mention overlay metrics', () => {
  it('keeps the transparent textarea caret aligned with mention overlay glyphs', () => {
    const layer = cssDeclarations('.composer-textarea-layer');
    const overlay = cssDeclarations('.composer-input-overlay');
    const mention = cssDeclarations('.composer-inline-mention');

    expect(ruleValue(layer, 'font-size')).toBe('13px');
    expect(ruleValue(overlay, 'font')).toBe('inherit');
    expect(ruleValue(overlay, 'line-height')).toBe('inherit');
    expect(ruleValue(overlay, 'overflow-wrap')).toBe('break-word');

    expect(ruleValue(mention, 'display')).toBe('inline');
    expect(ruleValue(mention, 'margin')).toBe('0 -1px');
    expect(ruleValue(mention, 'padding')).toBe('0 1px');
    expect(ruleValue(mention, 'white-space')).toBe('inherit');
    expect(optionalRuleValue(mention, 'box-decoration-break')).toBeNull();
    expect(optionalRuleValue(mention, '-webkit-box-decoration-break')).toBeNull();
  });

  it('does not pin the app composer textarea font size separately from its overlay', () => {
    const appTextarea = cssDeclarations('.app .composer textarea');

    expect(optionalRuleValue(appTextarea, 'font-size')).toBeNull();
  });
});
