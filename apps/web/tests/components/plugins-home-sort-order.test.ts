// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { InstalledPluginRecord } from '@open-design/contracts';
import {
  DEFAULT_PLUGIN_SORT_ORDER,
  readStoredSortOrder,
  sortByNewest,
  writeStoredSortOrder,
} from '../../src/components/plugins-home/sortOrder';

function fixture(overrides: {
  id: string;
  installedAt?: number;
  updatedAt?: number;
}): InstalledPluginRecord {
  return {
    id: overrides.id,
    title: overrides.id,
    version: '0.1.0',
    sourceKind: 'bundled',
    source: '/tmp',
    trust: 'bundled',
    capabilitiesGranted: ['prompt:inject'],
    manifest: { name: overrides.id, version: '0.1.0' },
    fsPath: '/tmp',
    installedAt: overrides.installedAt ?? 0,
    updatedAt: overrides.updatedAt ?? 0,
  };
}

describe('sortByNewest', () => {
  it('orders by updatedAt descending', () => {
    const records = [
      fixture({ id: 'old', updatedAt: 100 }),
      fixture({ id: 'newest', updatedAt: 300 }),
      fixture({ id: 'mid', updatedAt: 200 }),
    ];

    expect(sortByNewest(records).map((record) => record.id)).toEqual([
      'newest',
      'mid',
      'old',
    ]);
  });

  it('breaks updatedAt ties by installedAt descending', () => {
    const records = [
      fixture({ id: 'earlier-install', updatedAt: 100, installedAt: 10 }),
      fixture({ id: 'later-install', updatedAt: 100, installedAt: 20 }),
    ];

    expect(sortByNewest(records).map((record) => record.id)).toEqual([
      'later-install',
      'earlier-install',
    ]);
  });

  it('keeps the incoming order for fully tied records', () => {
    const records = [
      fixture({ id: 'appeal-first', updatedAt: 50, installedAt: 50 }),
      fixture({ id: 'appeal-second', updatedAt: 50, installedAt: 50 }),
      fixture({ id: 'appeal-third', updatedAt: 50, installedAt: 50 }),
    ];

    expect(sortByNewest(records).map((record) => record.id)).toEqual([
      'appeal-first',
      'appeal-second',
      'appeal-third',
    ]);
  });

  it('does not mutate the input array', () => {
    const records = [
      fixture({ id: 'a', updatedAt: 1 }),
      fixture({ id: 'b', updatedAt: 2 }),
    ];

    sortByNewest(records);

    expect(records.map((record) => record.id)).toEqual(['a', 'b']);
  });
});

describe('sort-order persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to hot when nothing is stored', () => {
    expect(readStoredSortOrder()).toBe(DEFAULT_PLUGIN_SORT_ORDER);
    expect(readStoredSortOrder()).toBe('hot');
  });

  it('round-trips the picked order', () => {
    writeStoredSortOrder('newest');
    expect(readStoredSortOrder()).toBe('newest');
    writeStoredSortOrder('hot');
    expect(readStoredSortOrder()).toBe('hot');
  });

  it('falls back to the default on an unknown stored value', () => {
    window.localStorage.setItem('open-design:plugins-sort-order', 'bogus');
    expect(readStoredSortOrder()).toBe('hot');
  });
});
