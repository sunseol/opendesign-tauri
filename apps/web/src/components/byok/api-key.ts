import type { ApiProtocol } from '../../types';

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

export function cleanByokApiKey(value: string): string {
  return value
    .replace(ZERO_WIDTH_CHARS, '')
    .replace(/[\r\n\t]+/g, '')
    .trim();
}

export function detectByokApiKeyProtocol(apiKey: string): ApiProtocol | null {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (isGoogleGeminiApiKeyShape(apiKey)) return 'google';
  if (apiKey.startsWith('sk-')) return 'openai';
  return null;
}

export function isGoogleGeminiApiKeyShape(apiKey: string): boolean {
  if (apiKey.startsWith('AIza')) return true;
  return /^AQ\.[A-Za-z0-9_-]{20,}$/.test(apiKey);
}
