// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InputFieldSpec, InstalledPluginRecord } from '@open-design/contracts';
import { HomeHero } from '../../src/components/HomeHero';

afterEach(() => {
  cleanup();
});

function makePrototypePreset(
  id: string,
  title: string,
  tags: readonly string[],
): InstalledPluginRecord {
  const inputs: InputFieldSpec[] = [
    {
      name: 'topic',
      label: 'Topic',
      type: 'text',
      default: 'a focused brief',
    },
  ];
  return {
    id,
    title,
    version: '1.0.0',
    sourceKind: 'bundled',
    source: '/tmp',
    trust: 'bundled',
    capabilitiesGranted: ['prompt:inject'],
    manifest: {
      name: id,
      version: '1.0.0',
      title,
      description: `${title} fixture`,
      tags: [...tags],
      od: {
        mode: 'prototype',
        useCase: {
          query: `Create ${title} with {{topic}}`,
        },
        inputs,
        preview: { type: 'image', poster: '/preview.png' },
      },
    },
    fsPath: '/tmp',
    installedAt: 0,
    updatedAt: 0,
  };
}

function renderHero(pluginOptions: InstalledPluginRecord[]) {
  render(
    <HomeHero
      prompt=""
      onPromptChange={() => undefined}
      onSubmit={() => undefined}
      activePluginTitle={null}
      activeChipId="prototype"
      onClearActivePlugin={() => undefined}
      pluginOptions={pluginOptions}
      pluginsLoading={false}
      pendingPluginId={null}
      pendingChipId={null}
      onPickPlugin={() => undefined}
      onPickExamplePlugin={vi.fn()}
      onPickChip={() => undefined}
      onClearActiveChip={() => undefined}
      contextItemCount={0}
      error={null}
    />,
  );
}

describe('HomeHero subtype rail', () => {
  it('filters prototype preset cards by the selected second-level subtype', () => {
    const dashboard = makePrototypePreset(
      'prototype-dashboard',
      'Analytics dashboard',
      ['prototype', 'dashboard'],
    );
    const app = makePrototypePreset(
      'prototype-app',
      'Mobile app prototype',
      ['prototype', 'app'],
    );
    const landing = makePrototypePreset(
      'prototype-landing',
      'Landing page',
      ['prototype', 'landing'],
    );
    renderHero([dashboard, app, landing]);

    expect(screen.getAllByTestId('home-hero-plugin-preset')).toHaveLength(3);

    fireEvent.click(screen.getByTestId('home-hero-subtype-business-dashboards'));

    const presets = screen.getAllByTestId('home-hero-plugin-preset');
    expect(presets).toHaveLength(1);
    expect(presets[0]?.textContent).toContain('Analytics dashboard');
    expect(screen.queryByText('Mobile app prototype')).toBeNull();
    expect(screen.queryByText('Landing page')).toBeNull();

    fireEvent.click(screen.getByTestId('home-hero-subtype-all'));
    expect(screen.getAllByTestId('home-hero-plugin-preset')).toHaveLength(3);
  });
});
