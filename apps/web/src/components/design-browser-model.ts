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

export type PageCaptureCard = {
  readonly title: string;
  readonly url: string;
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

export function browserFileName(prefix: string, url: string, extension: 'md' | 'png' | 'svg'): string {
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

export function pageCaptureSvg(page: PageCaptureCard, capturedAt = new Date()): string {
  const title = page.title.trim() || labelFromUrl(page.url);
  const url = page.url.trim() || EMPTY_BROWSER_URL;
  const host = hostnameFromUrl(url);
  const capturedAtLabel = capturedAt.toISOString();
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img">',
    `<title>${escapeSvgText(title)} page capture</title>`,
    '<rect width="1280" height="720" fill="#f8fafc"/>',
    '<rect x="48" y="48" width="1184" height="624" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>',
    '<rect x="48" y="48" width="1184" height="76" rx="24" fill="#0f172a"/>',
    '<circle cx="92" cy="86" r="10" fill="#ef4444"/>',
    '<circle cx="124" cy="86" r="10" fill="#f59e0b"/>',
    '<circle cx="156" cy="86" r="10" fill="#22c55e"/>',
    '<rect x="200" y="70" width="864" height="32" rx="16" fill="#1e293b"/>',
    `<text x="224" y="92" font-family="Inter, Arial, sans-serif" font-size="18" fill="#cbd5e1">${escapeSvgText(url)}</text>`,
    '<rect x="96" y="176" width="1088" height="304" rx="28" fill="#eef2ff"/>',
    '<rect x="128" y="208" width="132" height="132" rx="28" fill="#ffffff" stroke="#c7d2fe"/>',
    `<text x="194" y="286" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="700" fill="#4f46e5">${escapeSvgText(host.slice(0, 1).toUpperCase())}</text>`,
    `<text x="296" y="270" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="700" fill="#111827">${escapeSvgText(title)}</text>`,
    `<text x="296" y="318" font-family="Inter, Arial, sans-serif" font-size="24" fill="#475569">${escapeSvgText(host)}</text>`,
    '<rect x="128" y="520" width="1024" height="2" fill="#e2e8f0"/>',
    `<text x="128" y="568" font-family="Inter, Arial, sans-serif" font-size="22" fill="#334155">Captured from Open Design Reference Board</text>`,
    `<text x="128" y="604" font-family="Inter, Arial, sans-serif" font-size="18" fill="#64748b">${escapeSvgText(capturedAtLabel)}</text>`,
    '</svg>',
  ].join('');
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

function escapeSvgText(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}
