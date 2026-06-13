import type { ApiProtocol } from '../../types';

export type NormalizedByokBaseUrl = {
  readonly value: string;
  readonly changed: boolean;
  readonly addedProtocol: boolean;
  readonly addedOpenAiVersionPath: boolean;
};

export const GOOGLE_GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

export function normalizeByokBaseUrl(
  value: string,
  protocol: ApiProtocol,
): NormalizedByokBaseUrl {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      value: '',
      changed: value !== '',
      addedProtocol: false,
      addedOpenAiVersionPath: false,
    };
  }

  const addedProtocol = !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withProtocol = addedProtocol ? `https://${trimmed}` : trimmed;
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, '');

  let normalized = withoutTrailingSlash;
  let addedOpenAiVersionPath = false;
  try {
    const parsed = new URL(withoutTrailingSlash);
    if (
      protocol === 'openai' &&
      parsed.hostname.toLowerCase() === 'api.openai.com' &&
      (parsed.pathname === '' || parsed.pathname === '/')
    ) {
      parsed.pathname = '/v1';
      normalized = parsed.toString().replace(/\/+$/, '');
      addedOpenAiVersionPath = true;
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    normalized = withoutTrailingSlash;
  }

  return {
    value: normalized,
    changed: normalized !== value,
    addedProtocol,
    addedOpenAiVersionPath,
  };
}

export function byokBaseUrlHostname(baseUrl: string): string | undefined {
  const trimmed = baseUrl.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
