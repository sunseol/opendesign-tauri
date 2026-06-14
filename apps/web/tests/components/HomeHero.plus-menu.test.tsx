// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ConnectorDetail,
  InstalledPluginRecord,
  McpServerConfig,
} from '@open-design/contracts';

import { HomeHero } from '../../src/components/HomeHero';

const PLUGIN: InstalledPluginRecord = {
  id: 'deck-maker',
  title: 'Deck Maker',
  version: '1.0.0',
  sourceKind: 'bundled',
  source: '/tmp/deck-maker',
  trust: 'bundled',
  capabilitiesGranted: ['prompt:inject'],
  manifest: {
    name: 'deck-maker',
    version: '1.0.0',
    title: 'Deck Maker',
    description: 'Builds a deck from the current brief.',
    od: { kind: 'scenario' },
  },
  fsPath: '/tmp/deck-maker',
  installedAt: 0,
  updatedAt: 0,
};

const CONNECTOR: ConnectorDetail = {
  id: 'github',
  name: 'GitHub',
  provider: 'github',
  category: 'dev',
  status: 'connected',
  tools: [],
};

const MCP_SERVER: McpServerConfig = {
  id: 'linear',
  label: 'Linear MCP',
  transport: 'stdio',
  enabled: true,
};

function renderHero(overrides: Partial<ComponentProps<typeof HomeHero>> = {}) {
  const props: ComponentProps<typeof HomeHero> = {
    prompt: 'Keep this brief',
    onPromptChange: vi.fn(),
    onSubmit: vi.fn(),
    activePluginTitle: null,
    activeChipId: null,
    onClearActivePlugin: vi.fn(),
    pluginOptions: [PLUGIN],
    pluginsLoading: false,
    skillOptions: [],
    skillsLoading: false,
    mcpOptions: [MCP_SERVER],
    mcpLoading: false,
    connectorOptions: [CONNECTOR],
    pendingPluginId: null,
    pendingChipId: null,
    onPickPlugin: vi.fn(),
    onPickSkill: vi.fn(),
    onPickMcp: vi.fn(),
    onPickConnector: vi.fn(),
    onPickChip: vi.fn(),
    contextItemCount: 0,
    error: null,
    ...overrides,
  };
  return {
    props,
    ...render(<HomeHero {...props} />),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HomeHero plus menu', () => {
  it('opens the shared composer menu and attaches files from the menu row', () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    renderHero();

    fireEvent.click(screen.getByTestId('home-hero-plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Attach/i }));

    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the current draft when adding plugin context', () => {
    const { props } = renderHero();

    fireEvent.click(screen.getByTestId('home-hero-plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Plugins/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Deck Maker/i }));

    expect(props.onPickPlugin).toHaveBeenCalledWith(PLUGIN, 'Keep this brief');
  });

  it('keeps the current draft when adding connector context', () => {
    const { props } = renderHero();

    fireEvent.click(screen.getByTestId('home-hero-plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Connectors/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /GitHub/i }));

    expect(props.onPickConnector).toHaveBeenCalledWith(CONNECTOR, 'Keep this brief');
  });

  it('keeps the current draft when adding MCP context', () => {
    const { props } = renderHero();

    fireEvent.click(screen.getByTestId('home-hero-plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: /^MCP/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Linear MCP/i }));

    expect(props.onPickMcp).toHaveBeenCalledWith(MCP_SERVER, 'Keep this brief');
  });
});
