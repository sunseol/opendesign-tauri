// Shared "example preset" seed logic for Home preset cards and plugin-use
// handoffs. The full plugin query remains available as plugin context; this
// helper decides only what human-readable seed lands in the composer.

import type { InstalledPluginRecord } from '@open-design/contracts';
import type { Locale } from '../../i18n/types';
import { localizePluginDescription } from './localization';

const INPUT_PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_][\w-]*)\s*\}\}/g;
const HAS_INPUT_PLACEHOLDER_PATTERN = /\{\{\s*[a-zA-Z_][\w-]*\s*\}\}/;

const HOME_ESCAPED_ARGUMENT_PLACEHOLDER_PATTERN =
  /\{argument\s+name=\\"([^"]+)\\"\s+default=\\"([^"]*)\\"[^}]*\}/g;

const HOME_ARGUMENT_PLACEHOLDER_PATTERN =
  /\{argument\s+name=(?:"([^"]+)"|'([^']+)')\s+default=(?:"([^"]*)"|'([^']*)')[^}]*\}/g;

export type PromptLocaleKind = 'zh' | 'ja' | 'en';

export interface PresetSeed {
  text: string;
  fromRenderedQuery: boolean;
}

export function promptLocaleKind(locale: Locale): PromptLocaleKind {
  if (locale === 'zh-CN' || locale === 'zh-TW') return 'zh';
  if (locale === 'ja') return 'ja';
  return 'en';
}

export function pluginPresetQuery(
  record: InstalledPluginRecord,
  locale: Locale,
): string | null {
  const query = record.manifest?.od?.useCase?.query;
  if (typeof query === 'string') return query;
  if (query && typeof query === 'object') {
    const localized = query as Record<string, unknown>;
    const exact = localized[locale];
    if (typeof exact === 'string') return exact;
    const language = locale.split('-')[0];
    const languageMatch = Object.entries(localized).find(([key, value]) => (
      key.toLowerCase().startsWith(`${language}-`) && typeof value === 'string'
    ));
    if (typeof languageMatch?.[1] === 'string') return languageMatch[1];
    for (const key of ['zh-CN', 'en', 'default']) {
      if (typeof localized[key] === 'string') return localized[key];
    }
    const first = Object.values(localized).find((value) => typeof value === 'string');
    if (typeof first === 'string') return first;
  }
  return null;
}

export function renderPluginPresetQuery(
  record: InstalledPluginRecord,
  query: string,
): string {
  const fields = record.manifest?.od?.inputs ?? [];
  const valueByName = new Map<string, string>();
  for (const field of fields) {
    const value = field.default ?? field.placeholder ?? field.label ?? field.name;
    valueByName.set(field.name, String(value));
  }
  return query
    .replace(
      HOME_ESCAPED_ARGUMENT_PLACEHOLDER_PATTERN,
      (_placeholder, _name: string | undefined, defaultValue: string | undefined) => defaultValue ?? '',
    )
    .replace(
      HOME_ARGUMENT_PLACEHOLDER_PATTERN,
      (
        _placeholder,
        _doubleName: string | undefined,
        _singleName: string | undefined,
        doubleDefault: string | undefined,
        singleDefault: string | undefined,
      ) => doubleDefault ?? singleDefault ?? '',
    )
    .replace(INPUT_PLACEHOLDER_PATTERN, (_placeholder, key: string) => (
      valueByName.get(key) ?? key
    ));
}

export function firstPromptParagraph(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  const [head] = normalized.split(/\n\s*\n/);
  return (head ?? normalized).trim();
}

export function isMetaInstructionSeed(value: string): boolean {
  return /逐字注入|以\s*en\s*字段为准|verbatim|example\.html/iu.test(value);
}

function usableQueryHead(record: InstalledPluginRecord, query: string): string | null {
  const head = firstPromptParagraph(renderPluginPresetQuery(record, query));
  if (head && !isMetaInstructionSeed(head)) return head;
  return null;
}

export function examplePresetSeedPrompt(
  record: InstalledPluginRecord,
  locale: Locale,
  fallback: () => string,
): PresetSeed {
  const description = localizePluginDescription(locale, record).trim();
  if (promptLocaleKind(locale) === 'zh' && description) {
    return { text: description, fromRenderedQuery: false };
  }

  const query = pluginPresetQuery(record, locale);
  if (query && HAS_INPUT_PLACEHOLDER_PATTERN.test(firstPromptParagraph(query))) {
    const head = usableQueryHead(record, query);
    if (head) return { text: head, fromRenderedQuery: true };
  }

  if (description) return { text: description, fromRenderedQuery: false };
  if (query) {
    const head = usableQueryHead(record, query);
    if (head) return { text: head, fromRenderedQuery: true };
  }
  return { text: fallback(), fromRenderedQuery: false };
}
