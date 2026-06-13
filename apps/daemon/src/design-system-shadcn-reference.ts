import { isIP } from 'node:net';

import {
  badShadcnReference,
  type HostClass,
  type ParsedShadcnReference,
} from './design-system-shadcn-types.js';

export function parseShadcnReference(input: string): ParsedShadcnReference {
  const trimmed = (input ?? '').trim();
  if (!trimmed) {
    throw badShadcnReference('a shadcn registry reference is required');
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw badShadcnReference('reference is not a valid URL');
    }
    assertFetchableUrl(url);
    const item = decodeReferenceFragment(url);
    const clean = `${url.origin}${url.pathname}${url.search}`;
    return { kind: 'url', url: clean, ...(item ? { item } : {}) };
  }

  const hashIndex = trimmed.indexOf('#');
  const pathPart = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const refPart = hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : '';
  const segments = pathPart.split('/').filter(Boolean);
  if (segments.length !== 3) {
    throw badShadcnReference(
      'reference must be "<owner>/<repo>/<item>" or an https URL to a registry item',
    );
  }
  const [owner, repo, item] = segments as [string, string, string];
  for (const [label, segment] of [
    ['owner', owner],
    ['repo', repo],
    ['item', item],
  ] as const) {
    if (!isShadcnSegment(segment)) {
      throw badShadcnReference(`reference ${label} contains unsupported characters`);
    }
  }
  const ref = refPart.trim();
  if (ref && !isGitRef(ref)) {
    throw badShadcnReference('reference git ref contains unsupported characters');
  }
  return { kind: 'github', owner, repo, item, ...(ref ? { ref } : {}) };
}

export function assertFetchableUrl(url: URL): void {
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw badShadcnReference('only http(s) registry URLs are supported');
  }
  const hostClass = classifyHost(url.hostname);
  if (hostClass === 'blocked') {
    throw badShadcnReference(
      `refusing to fetch "${url.hostname}": private, loopback-internal, link-local, and other non-routable addresses are not allowed`,
    );
  }
  if (hostClass === 'loopback') return;
  if (protocol !== 'https:') {
    throw badShadcnReference(
      'only https:// is allowed for non-loopback registry hosts (http:// is allowed for localhost only)',
    );
  }
}

function decodeReferenceFragment(url: URL): string | undefined {
  if (!url.hash) return undefined;
  try {
    const fragment = decodeURIComponent(url.hash.replace(/^#/, '')).trim();
    return fragment || undefined;
  } catch {
    throw badShadcnReference('reference fragment is not valid percent-encoding');
  }
}

function classifyHost(rawHost: string): HostClass {
  let host = rawHost.trim().toLowerCase();
  if (!host) return 'blocked';
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);

  if (host === 'localhost' || host.endsWith('.localhost')) return 'loopback';
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/.test(host)) return 'blocked';

  const kind = isIP(host);
  if (kind === 4) return classifyIpv4(host);
  if (kind === 6) return classifyIpv6(host);
  return 'public';
}

function classifyIpv4(ip: string): HostClass {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return 'blocked';
  }
  const a = parts[0] as number;
  const b = parts[1] as number;
  if (a === 127) return 'loopback';
  if (a === 0) return 'blocked';
  if (a === 10) return 'blocked';
  if (a === 172 && b >= 16 && b <= 31) return 'blocked';
  if (a === 192 && b === 168) return 'blocked';
  if (a === 169 && b === 254) return 'blocked';
  if (a === 100 && b >= 64 && b <= 127) return 'blocked';
  return 'public';
}

function classifyIpv6(ip: string): HostClass {
  const host = ip.toLowerCase();
  if (host === '::1') return 'loopback';
  if (host === '::') return 'blocked';
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
  const mappedIp = mapped?.[1];
  if (mappedIp) return classifyIpv4(mappedIp);
  const head = host.split(':')[0] ?? '';
  if (head.startsWith('fc') || head.startsWith('fd')) return 'blocked';
  if (/^fe[89ab]/.test(head)) return 'blocked';
  return 'public';
}

function isShadcnSegment(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value) && !value.startsWith('.') && !value.endsWith('.');
}

function isGitRef(value: string): boolean {
  return /^[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..') && !value.startsWith('/');
}
