// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer } from '../../src/components/ChatComposer';

const COMMUNITY_PLUGIN = {
  id: 'community-deck',
  title: 'Community Deck',
  version: '1.0.0',
  trust: 'restricted' as const,
  sourceKind: 'bundled' as const,
  source: 'bundled/community-deck',
  capabilitiesGranted: [],
  manifest: {
    name: 'community-deck',
    title: 'Community Deck',
    description: 'Official deck starter',
    od: { kind: 'skill' },
  },
  fsPath: '/plugins/community-deck',
  installedAt: 0,
  updatedAt: 0,
};

const USER_PLUGIN = {
  ...COMMUNITY_PLUGIN,
  id: 'my-export',
  title: 'My Export',
  sourceKind: 'local' as const,
  source: '/plugins/my-export',
  manifest: {
    ...COMMUNITY_PLUGIN.manifest,
    name: 'my-export',
    title: 'My Export',
    description: 'Private export workflow',
  },
};

const SKILL = {
  id: 'deck-builder',
  name: 'Deck Builder',
  description: 'Build a polished slide deck.',
  triggers: ['deck'],
  mode: 'deck' as const,
  previewType: 'html',
  designSystemRequired: false,
  defaultFor: [],
  upstream: null,
  hasBody: true,
  examplePrompt: 'Make a deck',
  aggregatesExamples: false,
};

const APPLY_RESULT = {
  ok: true,
  query: 'Run plugin.',
  contextItems: [],
  inputs: [],
  assets: [],
  mcpServers: [],
  trust: 'restricted',
  capabilitiesGranted: ['prompt:inject'],
  capabilitiesRequired: ['prompt:inject'],
  appliedPlugin: {
    snapshotId: 'snap-1',
    pluginId: USER_PLUGIN.id,
    pluginVersion: '1.0.0',
    manifestSourceDigest: 'a'.repeat(64),
    inputs: {},
    resolvedContext: { items: [] },
    capabilitiesGranted: ['prompt:inject'],
    capabilitiesRequired: ['prompt:inject'],
    assetsStaged: [],
    taskKind: 'new-generation',
    appliedAt: 0,
    connectorsRequired: [],
    connectorsResolved: [],
    mcpServers: [],
    status: 'fresh',
  },
  projectMetadata: {},
};

function renderComposer(overrides: Partial<ComponentProps<typeof ChatComposer>> = {}) {
  return render(
    <ChatComposer
      projectId="project-1"
      projectFiles={[]}
      streaming={false}
      onEnsureProject={async () => 'project-1'}
      onSend={vi.fn()}
      onStop={vi.fn()}
      onOpenMcpSettings={vi.fn()}
      skills={[SKILL]}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  const plugins = [COMMUNITY_PLUGIN, USER_PLUGIN];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/mcp/servers') {
      return new Response(JSON.stringify({ servers: [], templates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/plugins') {
      return new Response(JSON.stringify({ plugins }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/api/plugins/') && url.endsWith('/apply')) {
      return new Response(JSON.stringify(APPLY_RESULT), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/projects/project-1' && init?.method === 'PATCH') {
      return new Response(JSON.stringify({ project: { id: 'project-1', skillId: SKILL.id } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ChatComposer plus menu', () => {
  it('inserts a skill mention at the caret when picking from Skills', async () => {
    const onProjectSkillChange = vi.fn();
    renderComposer({ onProjectSkillChange });
    const input = screen.getByTestId('chat-composer-input');
    if (!(input instanceof HTMLTextAreaElement)) {
      throw new Error('Expected chat composer input to be a textarea.');
    }

    fireEvent.change(input, {
      target: { value: 'Build ', selectionStart: 6 },
    });
    input.setSelectionRange(6, 6);
    fireEvent.click(screen.getByTestId('chat-plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Skills' }));
    fireEvent.click(screen.getByText('Deck Builder'));

    await waitFor(() => expect(onProjectSkillChange).toHaveBeenCalledWith('deck-builder'));
    await waitFor(() => expect(input.value).toBe('Build @Deck Builder '));
    expect(input.selectionStart).toBe('Build @Deck Builder '.length);
  });

  it('keeps the existing Official and My plugins switcher inside Plugins', async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId('chat-plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Plugins' }));

    await waitFor(() => expect(screen.getByText('Community Deck')).toBeTruthy());
    expect(screen.queryByText('My Export')).toBeNull();

    fireEvent.click(screen.getByText('My plugins'));
    expect(screen.getByText('My Export')).toBeTruthy();
    expect(screen.queryByText('Community Deck')).toBeNull();

    fireEvent.change(screen.getByLabelText('Search plugins'), {
      target: { value: 'private' },
    });
    expect(screen.getByText('Private export workflow')).toBeTruthy();
  });
});
