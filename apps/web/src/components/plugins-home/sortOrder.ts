import type { InstalledPluginRecord } from '@open-design/contracts';

export type PluginSortOrder = 'hot' | 'newest';

export const DEFAULT_PLUGIN_SORT_ORDER: PluginSortOrder = 'hot';

const SORT_ORDER_KEY = 'open-design:plugins-sort-order';

function isExpectedStorageError(error: unknown): boolean {
  return (
    error instanceof Error ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException)
  );
}

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (error) {
    if (isExpectedStorageError(error)) return false;
    throw error;
  }
}

function ignoreExpectedStorageError(error: unknown): void {
  if (isExpectedStorageError(error)) return;
  throw error;
}

function isPluginSortOrder(value: unknown): value is PluginSortOrder {
  return value === 'hot' || value === 'newest';
}

export function readStoredSortOrder(): PluginSortOrder {
  if (!isBrowserStorageAvailable()) return DEFAULT_PLUGIN_SORT_ORDER;
  try {
    const raw = window.localStorage.getItem(SORT_ORDER_KEY);
    return isPluginSortOrder(raw) ? raw : DEFAULT_PLUGIN_SORT_ORDER;
  } catch (error) {
    ignoreExpectedStorageError(error);
    return DEFAULT_PLUGIN_SORT_ORDER;
  }
}

export function writeStoredSortOrder(order: PluginSortOrder): void {
  if (!isBrowserStorageAvailable()) return;
  try {
    window.localStorage.setItem(SORT_ORDER_KEY, order);
  } catch (error) {
    if (!isExpectedStorageError(error)) throw error;
    return;
  }
}

export function sortByNewest<T extends InstalledPluginRecord>(
  records: readonly T[],
): T[] {
  const annotated = records.map((record, index) => ({ record, index }));
  annotated.sort((a, b) => {
    if (b.record.updatedAt !== a.record.updatedAt) {
      return b.record.updatedAt - a.record.updatedAt;
    }
    if (b.record.installedAt !== a.record.installedAt) {
      return b.record.installedAt - a.record.installedAt;
    }
    return a.index - b.index;
  });
  return annotated.map((item) => item.record);
}
