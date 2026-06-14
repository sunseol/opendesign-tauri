import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(indexCss);
  if (!match) throw new Error(`Missing CSS block for ${selector}`);
  return match[1] ?? '';
}

describe('default app background colors', () => {
  it('uses the release light background color by default', () => {
    const root = cssBlock(':root');

    expect(root).toContain('--bg: #faf9f7;');
    expect(root).toContain('--bg-app: #faf9f7;');
  });

  it('keeps the dark theme background unchanged', () => {
    const dark = cssBlock('[data-theme="dark"]');

    expect(dark).toContain('--bg: #1a1917;');
    expect(dark).toContain('--bg-app: #1a1917;');
  });

  it('switches to a CJK comfort stack for Chinese, Japanese, and Korean locales', () => {
    expect(indexCss).toContain(':lang(zh), :lang(zh-CN), :lang(zh-TW), :lang(ja), :lang(ko)');
    expect(indexCss).toContain('"PingFang SC"');
    expect(indexCss).toContain('"Noto Sans SC"');
    expect(indexCss).toContain('"Source Han Sans SC"');
  });

  it('switches to Arabic-capable fonts for RTL locales', () => {
    const rtl = cssBlock('[dir="rtl"]');

    expect(rtl).toContain('"Cairo"');
    expect(rtl).toContain('"Noto Sans Arabic"');
  });
});
