// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorDetail, InstalledPluginRecord } from '@open-design/contracts';

import { ComposerPlusMenu } from '../../src/components/ComposerPlusMenu';
import { I18nProvider } from '../../src/i18n';
import type { McpServerConfig } from '../../src/state/mcp';

const CONNECTOR: ConnectorDetail = {
  id: 'github',
  name: 'GitHub',
  provider: 'github',
  category: 'dev',
  status: 'connected',
  tools: [],
};
const PLUGIN: InstalledPluginRecord = {
  id: 'deck-maker',
  title: 'Deck Maker',
  version: '1.0.0',
  trust: 'restricted',
  sourceKind: 'bundled',
  source: 'bundled/deck-maker',
  capabilitiesGranted: [],
  manifest: {
    name: 'deck-maker',
    title: 'Deck Maker',
    version: '1.0.0',
    od: { kind: 'skill' },
  },
  fsPath: '/plugins/deck-maker',
  installedAt: 0,
  updatedAt: 0,
};
const MCP_SERVER: McpServerConfig = {
  id: 'linear',
  label: 'Linear MCP',
  transport: 'stdio',
  enabled: true,
};

function renderMenu(overrides: Partial<ComponentProps<typeof ComposerPlusMenu>> = {}) {
  const props: ComponentProps<typeof ComposerPlusMenu> = {
    connectors: [CONNECTOR],
    onPickConnector: vi.fn(),
    plugins: [PLUGIN],
    onPickPlugin: vi.fn(),
    mcpServers: [MCP_SERVER],
    onPickMcp: vi.fn(),
    onAttachFiles: vi.fn(),
    triggerTestId: 'plus-trigger',
    ...overrides,
  };
  return {
    props,
    ...render(
      <I18nProvider initial="en">
        <ComposerPlusMenu {...props} />
      </I18nProvider>,
    ),
  };
}

function expectPickRowPreventsMousedown(name: RegExp) {
  const row = screen.getByRole('menuitem', { name });
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  row.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
}

afterEach(() => {
  cleanup();
});

describe('ComposerPlusMenu', () => {
  it('keeps caret focus on connector, plugin, and MCP picker rows', () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('plus-trigger'));

    fireEvent.click(screen.getByRole('menuitem', { name: /Connectors/i }));
    expectPickRowPreventsMousedown(/GitHub/i);

    fireEvent.click(screen.getByRole('menuitem', { name: /Plugins/i }));
    expectPickRowPreventsMousedown(/Deck Maker/i);

    fireEvent.click(screen.getByRole('menuitem', { name: /^MCP/i }));
    expectPickRowPreventsMousedown(/Linear MCP/i);
  });

  it('portals and flips the popup when the trigger is near the viewport bottom', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 420 });

    try {
      renderMenu();
      const trigger = screen.getByTestId('plus-trigger');
      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error('Expected plus trigger to be a button.');
      }
      trigger.getBoundingClientRect = () => new DOMRect(8, 376, 28, 28);

      fireEvent.click(trigger);

      const menu = screen.getByRole('menu');
      expect(menu.parentElement).toBe(document.body);
      expect(menu.style.top).toBe('auto');
      expect(menu.style.bottom).toBe('52px');
      expect(menu.style.maxHeight).toBe('356px');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    }
  });
});
