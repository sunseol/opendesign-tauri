// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeHero } from '../../src/components/HomeHero';

afterEach(() => {
  cleanup();
});

const baseProps: ComponentProps<typeof HomeHero> = {
  prompt: '',
  onPromptChange: vi.fn(),
  onSubmit: vi.fn(),
  activePluginTitle: null,
  activeChipId: 'deck',
  onClearActivePlugin: vi.fn(),
  pluginOptions: [],
  pluginsLoading: false,
  pendingPluginId: null,
  pendingChipId: null,
  onPickPlugin: vi.fn(),
  onPickChip: vi.fn(),
  contextItemCount: 0,
  error: null,
};

function renderHero(overrides: Partial<ComponentProps<typeof HomeHero>> = {}) {
  render(<HomeHero {...baseProps} {...overrides} />);
}

describe('HomeHero example cards', () => {
  it('renders prompt example cards for the active creation chip', () => {
    renderHero();

    expect(screen.getAllByTestId('home-hero-prompt-example')).toHaveLength(4);
  });

  it('does not render overlay icons inside prompt example cards', () => {
    renderHero();

    for (const card of screen.getAllByTestId('home-hero-prompt-example')) {
      expect(card.querySelector('svg')).toBeNull();
    }
  });
});
