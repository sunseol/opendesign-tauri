// @vitest-environment jsdom

import { installMockOpenDesignHost } from '@open-design/host/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectInitialLocale } from '../../src/i18n';

const LS_KEY = 'open-design:locale';
const LS_SOURCE_KEY = 'open-design:locale-source';

function setStoredLocale(locale: string, source: 'manual' | 'untagged' = 'manual'): void {
  window.localStorage.setItem(LS_KEY, locale);
  if (source === 'manual') {
    window.localStorage.setItem(LS_SOURCE_KEY, 'manual');
  } else {
    window.localStorage.removeItem(LS_SOURCE_KEY);
  }
}

function setNavigatorLanguages(languages: readonly string[]): void {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    get: () => languages,
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    get: () => languages[0] ?? 'en',
  });
}

let uninstallHost: (() => void) | null = null;

function installHostWithOsLocale(value: unknown): void {
  uninstallHost?.();
  uninstallHost = installMockOpenDesignHost({
    host: {
      client: { osLocale: value as string | undefined },
    },
  });
}

function clearHost(): void {
  uninstallHost?.();
  uninstallHost = null;
}

describe('detectInitialLocale', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearHost();
    setNavigatorLanguages(['en-US']);
  });

  afterEach(() => {
    window.localStorage.clear();
    clearHost();
  });

  it('prefers manually tagged localStorage over host and navigator locales', () => {
    setStoredLocale('ja');
    installHostWithOsLocale('zh-CN');
    setNavigatorLanguages(['fr-FR']);

    expect(detectInitialLocale()).toBe('ja');
  });

  it('ignores untagged localStorage when the host provides an OS locale', () => {
    setStoredLocale('ja', 'untagged');
    installHostWithOsLocale('zh-CN');

    expect(detectInitialLocale()).toBe('zh-CN');
  });

  it('normalizes host OS locale strings through supported locale detection', () => {
    installHostWithOsLocale('zh-Hant-TW');
    setNavigatorLanguages(['en-US']);

    expect(detectInitialLocale()).toBe('zh-TW');
  });

  it('falls back to navigator when host locale is unavailable', () => {
    installHostWithOsLocale(42);
    setNavigatorLanguages(['fr-FR']);

    expect(detectInitialLocale()).toBe('fr');
  });
});
