import { describe, expect, it } from 'vitest';

import type {
  AppliedPluginSnapshot,
  InstalledPluginRecord,
  PluginManifest,
} from '@open-design/contracts';
import {
  getManifestContextCraft,
  getPluginContextCraft,
  getSnapshotContextCraft,
} from '../src/plugins/context-craft.js';

function manifestWithCraft(craft?: string[]): PluginManifest {
  return {
    name: 'fixture-plugin',
    title: 'Fixture Plugin',
    version: '0.1.0',
    description: 'Fixture plugin.',
    od: {
      kind: 'scenario',
      taskKind: 'new-generation',
      useCase: { query: 'Generate a fixture artifact.' },
      ...(craft
        ? { context: { craft } }
        : {}),
      capabilities: ['prompt:inject'],
    },
  };
}

function pluginRecord(manifest: PluginManifest): InstalledPluginRecord {
  return {
    id: 'fixture-plugin',
    title: 'Fixture Plugin',
    version: '0.1.0',
    sourceKind: 'local',
    source: '/tmp/fixture-plugin',
    trust: 'trusted',
    capabilitiesGranted: ['prompt:inject'],
    fsPath: '/tmp/fixture-plugin',
    installedAt: 0,
    updatedAt: 0,
    manifest,
  };
}

function snapshot(craftRequires?: string[]): AppliedPluginSnapshot {
  return {
    snapshotId: 'snapshot-1',
    pluginId: 'fixture-plugin',
    pluginVersion: '0.1.0',
    manifestSourceDigest: 'digest-before-update',
    inputs: {},
    resolvedContext: { items: [] },
    ...(craftRequires ? { craftRequires } : {}),
    capabilitiesGranted: ['prompt:inject'],
    capabilitiesRequired: ['prompt:inject'],
    assetsStaged: [],
    taskKind: 'new-generation',
    appliedAt: 1,
    connectorsRequired: [],
    connectorsResolved: [],
    mcpServers: [],
    status: 'fresh',
  };
}

describe('plugin context craft helpers', () => {
  it('returns declared plugin craft slugs in manifest order', () => {
    const manifest = manifestWithCraft(['typography', 'color', 'anti-ai-slop']);
    expect(getManifestContextCraft(manifest)).toEqual([
      'typography',
      'color',
      'anti-ai-slop',
    ]);
    expect(getPluginContextCraft(pluginRecord(manifest))).toEqual([
      'typography',
      'color',
      'anti-ai-slop',
    ]);
  });

  it('drops blanks and duplicate craft slugs after trimming', () => {
    expect(getManifestContextCraft(manifestWithCraft([
      ' typography ',
      '',
      'color',
      'typography',
    ]))).toEqual(['typography', 'color']);
  });

  it('returns an empty array when no craft is declared', () => {
    expect(getManifestContextCraft(manifestWithCraft())).toEqual([]);
    expect(getSnapshotContextCraft(snapshot())).toEqual([]);
  });

  it('keeps replay craft frozen on the applied snapshot after the installed manifest changes', () => {
    expect(getPluginContextCraft(pluginRecord(manifestWithCraft(['color'])))).toEqual(['color']);
    expect(getSnapshotContextCraft(snapshot(['typography', 'anti-ai-slop']))).toEqual([
      'typography',
      'anti-ai-slop',
    ]);
  });
});
