const CURATED: Record<string, string> = {
  notion: '#0B0B0B',
  chrome: '#1A73E8',
  claudeinchrome: '#1A73E8',
  googlesheets: '#188038',
  google_sheets: '#188038',
  spreadsheets: '#188038',
  github: '#1F2328',
  figma: '#A259FF',
  slack: '#4A154B',
  linear: '#5E6AD2',
  posthog: '#C8401A',
  gmail: '#C5221F',
  googledrive: '#1A73E8',
  airtable: '#D54402',
};

const FALLBACK_PALETTE = [
  '#1F6FEB',
  '#B5360F',
  '#2E7D32',
  '#6A4FB6',
  '#B0337A',
  '#0F766E',
  '#9A6A00',
  '#334155',
];

export type BrandTheme = 'light' | 'dark';

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function hashIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1]!, 16);
  return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

const DARK_THEME_MIN_LUMINANCE = 0.4;

function lightenForDark(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const luminance = relativeLuminance(rgb);
  if (luminance >= DARK_THEME_MIN_LUMINANCE) return hex;
  const ratio = (DARK_THEME_MIN_LUMINANCE - luminance) / (1 - luminance);
  return toHex({
    r: rgb.r + (255 - rgb.r) * ratio,
    g: rgb.g + (255 - rgb.g) * ratio,
    b: rgb.b + (255 - rgb.b) * ratio,
  });
}

export function connectorBrandColor(
  connector: { id: string; name: string },
  theme: BrandTheme = 'light',
): string {
  const idKey = normalizeKey(connector.id);
  const nameKey = normalizeKey(connector.name);
  const seed = connector.id || connector.name;
  const base =
    CURATED[idKey] ??
    CURATED[nameKey] ??
    FALLBACK_PALETTE[hashIndex(seed, FALLBACK_PALETTE.length)]!;
  return theme === 'dark' ? lightenForDark(base) : base;
}

export function resolveBrandTheme(): BrandTheme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
