import { describe, expect, it } from 'vitest';

import {
  collectReferencedJsxNames,
  extractBabelScriptSrcs,
  findHtmlEntriesReferencing,
  htmlLoadsJsxModule,
  isJsxModule,
} from '../../src/runtime/jsx-module-refs';

const MULTI_FILE_HTML = `<!doctype html>
<html>
  <head><title>Backups Panel</title></head>
  <body>
    <div id="root"></div>
    <script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
    <script type="text/babel" src="tweaks-panel.jsx"></script>
    <script type="text/babel" src="icons.jsx"></script>
    <script type="text/babel" src="chrome.jsx"></script>
    <script type="text/babel" src="app.jsx"></script>
  </body>
</html>`;

describe('extractBabelScriptSrcs', () => {
  it('returns [] for empty or nullish input', () => {
    expect(extractBabelScriptSrcs('')).toEqual([]);
    expect(extractBabelScriptSrcs(null)).toEqual([]);
    expect(extractBabelScriptSrcs(undefined)).toEqual([]);
  });

  it('lists only text/babel module srcs in document order', () => {
    expect(extractBabelScriptSrcs(MULTI_FILE_HTML)).toEqual([
      'tweaks-panel.jsx',
      'icons.jsx',
      'chrome.jsx',
      'app.jsx',
    ]);
  });

  it('ignores CDN scripts and inline text/babel scripts', () => {
    expect(extractBabelScriptSrcs(MULTI_FILE_HTML)).not.toContain(
      'https://unpkg.com/react@18.3.1/umd/react.development.js',
    );
    expect(extractBabelScriptSrcs('<script type="text/babel">function App(){return null;}</script>')).toEqual([]);
  });

  it('handles src-before-type order and strips query or hash suffixes', () => {
    const html =
      '<script src="./icons.jsx?v=2" type="text/babel"></script>' +
      '<script type="text/babel" src="chrome.jsx#frag"></script>';
    expect(extractBabelScriptSrcs(html)).toEqual(['icons.jsx', 'chrome.jsx']);
  });

  it('ignores babel scripts commented out in HTML', () => {
    const html =
      '<!-- <script type="text/babel" src="legacy.jsx"></script> -->' +
      '<script type="text/babel" src="app.jsx"></script>';
    expect(extractBabelScriptSrcs(html)).toEqual(['app.jsx']);
  });
});

describe('jsx module reference helpers', () => {
  it('matches exact and basename references', () => {
    expect(htmlLoadsJsxModule(MULTI_FILE_HTML, 'icons.jsx')).toBe(true);
    expect(htmlLoadsJsxModule('<script type="text/babel" src="parts/icons.jsx"></script>', 'icons.jsx')).toBe(true);
    expect(htmlLoadsJsxModule(MULTI_FILE_HTML, 'unused.jsx')).toBe(false);
    expect(htmlLoadsJsxModule(MULTI_FILE_HTML, '')).toBe(false);
  });

  it('returns every HTML entry that loads the module in map order', () => {
    const sources = new Map<string, string>([
      ['Backups Panel.html', MULTI_FILE_HTML],
      ['Overview Panel.html', '<script type="text/babel" src="icons.jsx"></script>'],
      ['Unrelated.html', '<script type="text/babel" src="other.jsx"></script>'],
    ]);
    expect(findHtmlEntriesReferencing('icons.jsx', sources)).toEqual([
      'Backups Panel.html',
      'Overview Panel.html',
    ]);
    expect(isJsxModule('app.jsx', sources)).toBe(true);
    expect(isJsxModule('standalone-component.jsx', sources)).toBe(false);
  });
});

describe('collectReferencedJsxNames', () => {
  const files = [
    { name: 'Backups Panel.html' },
    { name: 'tweaks-panel.jsx' },
    { name: 'icons.jsx' },
    { name: 'chrome.jsx' },
    { name: 'app.jsx' },
    { name: 'standalone.jsx' },
    { name: 'styles.css' },
  ];

  it('returns project file names loaded by an HTML entry', async () => {
    const read = async (name: string) =>
      name === 'Backups Panel.html' ? MULTI_FILE_HTML : null;
    const result = await collectReferencedJsxNames(files, read);
    expect(result).toEqual(new Set(['tweaks-panel.jsx', 'icons.jsx', 'chrome.jsx', 'app.jsx']));
    expect(result.has('standalone.jsx')).toBe(false);
  });

  it('ignores script src values that point at files the project does not have', async () => {
    const read = async () => '<script type="text/babel" src="ghost.jsx"></script>';
    const result = await collectReferencedJsxNames(files, read);
    expect(result.size).toBe(0);
  });

  it('returns an empty set when no HTML entries exist', async () => {
    const read = async () => null;
    const result = await collectReferencedJsxNames([{ name: 'only.jsx' }], read);
    expect(result).toEqual(new Set());
  });
});
