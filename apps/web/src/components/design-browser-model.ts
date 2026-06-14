export const EMPTY_BROWSER_URL = 'about:blank';

const BROWSER_HISTORY_LIMIT = 80;

export type BrowserHistoryEntry = {
  readonly iconUrl?: string;
  readonly title: string;
  readonly url: string;
  readonly lastVisitedAt: number;
  readonly visitCount: number;
};

export type AddressDisplayParts = {
  readonly url: string;
  readonly title?: string;
};

export type PageBriefLink = {
  readonly text: string;
  readonly url: string;
};

export type PageBriefColor = {
  readonly value: string;
  readonly count: number;
};

export type PageBrief = {
  readonly title?: string;
  readonly url?: string;
  readonly description?: string;
  readonly headings?: readonly string[];
  readonly images?: readonly string[];
  readonly links?: readonly PageBriefLink[];
  readonly colors?: readonly PageBriefColor[];
};

export function normalizeBrowserAddress(rawAddress: string): string {
  const value = rawAddress.trim();
  if (!value || value === EMPTY_BROWSER_URL) return EMPTY_BROWSER_URL;
  if (/^(https?|file):\/\//iu.test(value)) return value;
  if (/^localhost(:\d+)?(\/.*)?$/iu.test(value)) return `http://${value}`;
  if (/^(127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/iu.test(value)) return `http://${value}`;
  if (value.startsWith('/')) {
    if (/^\/(api|artifacts|frames)(\/|$)/u.test(value) && typeof window !== 'undefined') {
      return new URL(value, window.location.origin).toString();
    }
    return `file://${encodeURI(value)}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/iu.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export function labelFromUrl(url: string): string {
  if (url === EMPTY_BROWSER_URL) return 'New Tab';
  const parsed = parseUrl(url);
  return parsed?.hostname.replace(/^www\./u, '') || url;
}

export function formatAddressDisplayParts(url: string, title?: string): AddressDisplayParts {
  if (url === EMPTY_BROWSER_URL) return { url: '' };
  const cleanTitle = title?.trim();
  if (!cleanTitle) return { url };
  const fallback = labelFromUrl(url);
  if (cleanTitle === fallback || cleanTitle === url) return { url };
  return { url: url.replace(/\/+$/u, ''), title: cleanTitle };
}

export function formatAddressDisplay(url: string, title?: string): string {
  const parts = formatAddressDisplayParts(url, title);
  if (!parts.url) return '';
  if (!parts.title) return parts.url;
  return `${parts.url} / ${parts.title}`;
}

export function hostnameFromUrl(url: string): string {
  return parseUrl(url)?.hostname.replace(/^www\./u, '') || url;
}

export function faviconUrl(url: string): string | undefined {
  if (!isHttpLikeUrl(url)) return undefined;
  const parsed = parseUrl(url);
  if (!parsed) return undefined;
  return new URL('/favicon.ico', parsed.origin).toString();
}

export function referenceIconUrl(url: string, size = 64): string | undefined {
  if (!isHttpLikeUrl(url)) return undefined;
  const parsed = parseUrl(url);
  if (!parsed?.hostname) return undefined;
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(parsed.hostname)}`;
}

export function isHistoryUrl(url: string): boolean {
  return url !== EMPTY_BROWSER_URL && (isHttpLikeUrl(url) || /^file:\/\//iu.test(url));
}

export function sameUrl(left: string, right: string): boolean {
  return left.replace(/\/+$/u, '') === right.replace(/\/+$/u, '');
}

export function isHistoryEntry(value: unknown): value is BrowserHistoryEntry {
  if (!isObjectRecord(value)) return false;
  if (!('url' in value) || !('title' in value) || !('lastVisitedAt' in value) || !('visitCount' in value)) {
    return false;
  }
  const iconUrl = 'iconUrl' in value ? value.iconUrl : undefined;
  return (
    typeof value.url === 'string' &&
    typeof value.title === 'string' &&
    typeof value.lastVisitedAt === 'number' &&
    typeof value.visitCount === 'number' &&
    (iconUrl === undefined || typeof iconUrl === 'string')
  );
}

export function loadHistory(projectId: string): readonly BrowserHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(historyStorageKey(projectId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isHistoryEntry)
      .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
      .slice(0, BROWSER_HISTORY_LIMIT);
  } catch (error) {
    if (isRecoverableStorageError(error)) return [];
    throw error;
  }
}

export function saveHistory(projectId: string, history: readonly BrowserHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      historyStorageKey(projectId),
      JSON.stringify(history.slice(0, BROWSER_HISTORY_LIMIT)),
    );
  } catch (error) {
    if (isRecoverableStorageError(error)) return;
    throw error;
  }
}

export function browserFileName(prefix: string, url: string, extension: 'md' | 'png'): string {
  const host = labelFromUrl(url).replace(/[^a-z0-9._-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'page';
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  return `browser/${prefix}-${host}-${stamp}.${extension}`;
}

export function pageBriefMarkdown(brief: PageBrief, fallbackUrl: string): string {
  const title = brief.title || labelFromUrl(fallbackUrl);
  const url = brief.url || fallbackUrl;
  const lines = [
    `# ${title}`,
    '',
    `Source: ${url}`,
    '',
    ...descriptionSection(brief.description),
    ...listSection('Headings', brief.headings),
    ...listSection('Images', brief.images),
    ...listSection('Links', brief.links?.map((link) => `${link.text} - ${link.url}`)),
    ...listSection('Colors', brief.colors?.map((color) => `${color.value} (${color.count})`)),
  ];
  return `${lines.join('\n').trim()}\n`;
}

function historyStorageKey(projectId: string): string {
  return `od:design-browser:${projectId}:history:v1`;
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

function isHttpLikeUrl(url: string): boolean {
  return /^https?:\/\//iu.test(url);
}

function isObjectRecord(value: unknown): value is object {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isRecoverableStorageError(error: unknown): boolean {
  return error instanceof SyntaxError || error instanceof TypeError || isDomException(error);
}

function isDomException(error: unknown): boolean {
  return typeof DOMException !== 'undefined' && error instanceof DOMException;
}

function descriptionSection(description: string | undefined): readonly string[] {
  if (!description) return [];
  return ['## Description', '', description, ''];
}

function listSection(title: string, values: readonly string[] | undefined): readonly string[] {
  const filtered = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (filtered.length === 0) return [];
  return [`## ${title}`, '', ...filtered.map((value) => `- ${value}`), ''];
}
