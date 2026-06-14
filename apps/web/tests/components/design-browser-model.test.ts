// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  browserFileName,
  faviconUrl,
  formatAddressDisplay,
  formatAddressDisplayParts,
  hostnameFromUrl,
  isHistoryEntry,
  isHistoryUrl,
  labelFromUrl,
  loadHistory,
  normalizeBrowserAddress,
  pageBriefMarkdown,
  referenceIconUrl,
  sameUrl,
  saveHistory,
} from '../../src/components/design-browser-model';

describe('design browser address model', () => {
  it('normalizes browser addresses for web, local, and search targets', () => {
    expect(normalizeBrowserAddress('  https://example.com/page  ')).toBe('https://example.com/page');
    expect(normalizeBrowserAddress('example.com:8080/path')).toBe('https://example.com:8080/path');
    expect(normalizeBrowserAddress('localhost:3000/dash')).toBe('http://localhost:3000/dash');
    expect(normalizeBrowserAddress('127.0.0.1:5173')).toBe('http://127.0.0.1:5173');
    expect(normalizeBrowserAddress('/Users/me/page with space.html')).toBe(
      `file://${encodeURI('/Users/me/page with space.html')}`,
    );
    expect(normalizeBrowserAddress('design inspiration')).toBe(
      'https://www.google.com/search?q=design%20inspiration',
    );
    expect(normalizeBrowserAddress('')).toBe('about:blank');
  });

  it('keeps app-relative browser routes on the current origin', () => {
    expect(normalizeBrowserAddress('/api/runs')).toBe(`${window.location.origin}/api/runs`);
    expect(normalizeBrowserAddress('/artifacts/x.png')).toBe(`${window.location.origin}/artifacts/x.png`);
    expect(normalizeBrowserAddress('/frames/1')).toBe(`${window.location.origin}/frames/1`);
  });

  it('formats passive address display without duplicating host fallback titles', () => {
    expect(labelFromUrl('about:blank')).toBe('New Tab');
    expect(labelFromUrl('https://www.example.com/page')).toBe('example.com');
    expect(formatAddressDisplay('https://www.example.com/path', 'example.com')).toBe(
      'https://www.example.com/path',
    );
    expect(formatAddressDisplay('https://www.baidu.com/', 'Baidu')).toBe('https://www.baidu.com / Baidu');
    expect(formatAddressDisplayParts('https://brandfetch.com/', 'Just a moment...')).toEqual({
      url: 'https://brandfetch.com',
      title: 'Just a moment...',
    });
  });

  it('derives host and icon URLs only for browser-safe schemes', () => {
    expect(hostnameFromUrl('https://www.example.com/docs')).toBe('example.com');
    expect(faviconUrl('https://www.example.com/docs')).toBe('https://www.example.com/favicon.ico');
    expect(referenceIconUrl('https://styles.refero.design/', 32)).toBe(
      'https://www.google.com/s2/favicons?sz=32&domain=styles.refero.design',
    );
    expect(faviconUrl('file:///Users/me/page.html')).toBeUndefined();
    expect(referenceIconUrl('file:///Users/me/page.html')).toBeUndefined();
  });

  it('compares history-safe URLs without trailing slash noise', () => {
    expect(sameUrl('https://example.com///', 'https://example.com')).toBe(true);
    expect(sameUrl('https://example.com/a', 'https://example.com/b')).toBe(false);
    expect(isHistoryUrl('https://example.com')).toBe(true);
    expect(isHistoryUrl('file:///Users/me/x.html')).toBe(true);
    expect(isHistoryUrl('about:blank')).toBe(false);
    expect(isHistoryUrl('mailto:hi@example.com')).toBe(false);
  });
});

describe('design browser history model', () => {
  const projectId = 'proj-history';

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('round-trips valid entries sorted by last visit and capped to the history limit', () => {
    const entries = Array.from({ length: 120 }, (_, index) => ({
      url: `https://site-${index}.com`,
      title: `Site ${index}`,
      lastVisitedAt: index,
      visitCount: 1,
    }));

    saveHistory(projectId, entries);
    const loaded = loadHistory(projectId);

    expect(loaded).toHaveLength(80);
    expect(loaded[0]?.url).toBe('https://site-79.com');
    expect(loaded.at(-1)?.url).toBe('https://site-0.com');
  });

  it('drops malformed entries and corrupt storage payloads', () => {
    const key = `od:design-browser:${projectId}:history:v1`;
    window.localStorage.setItem(
      key,
      JSON.stringify([
        { url: 'https://ok.com', title: 'OK', lastVisitedAt: 1, visitCount: 1 },
        { url: 123, title: 'bad', lastVisitedAt: 1, visitCount: 1 },
      ]),
    );

    expect(loadHistory(projectId)).toEqual([
      { url: 'https://ok.com', title: 'OK', lastVisitedAt: 1, visitCount: 1 },
    ]);
    window.localStorage.setItem(key, 'not json');
    expect(loadHistory(projectId)).toEqual([]);
    expect(isHistoryEntry({ url: 'https://x', title: 'X', lastVisitedAt: 1, visitCount: 1 })).toBe(true);
    expect(isHistoryEntry({ url: 'x', title: 'X', lastVisitedAt: 1 })).toBe(false);
  });
});

describe('design browser captured artifacts', () => {
  it('generates stable project-relative names for page captures', () => {
    const imageName = browserFileName('browser-capture', 'https://www.example.com/page', 'png');
    const markdownName = browserFileName('browser-brief', 'about:blank', 'md');

    expect(imageName).toMatch(/^browser\/browser-capture-example\.com-[\dTZ-]+\.png$/);
    expect(markdownName).toMatch(/^browser\/browser-brief-New-Tab-[\dTZ-]+\.md$/);
  });

  it('renders page briefs while skipping empty extracted sections', () => {
    const markdown = pageBriefMarkdown(
      {
        title: 'Example',
        url: 'https://example.com',
        description: 'A description',
        headings: ['Hero', '  ', 'Features'],
        images: [],
        links: [{ text: 'Docs', url: 'https://example.com/docs' }],
        colors: [{ value: 'rgb(0, 0, 0)', count: 4 }],
      },
      'https://fallback.example.com',
    );

    expect(markdown).toContain('# Example');
    expect(markdown).toContain('Source: https://example.com');
    expect(markdown).toContain('## Description');
    expect(markdown).toContain('- Hero');
    expect(markdown).not.toContain('## Images');
    expect(markdown).toContain('- Docs - https://example.com/docs');
    expect(markdown).toContain('- rgb(0, 0, 0) (4)');
  });
});
