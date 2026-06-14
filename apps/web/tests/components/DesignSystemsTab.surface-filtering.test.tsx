// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignSystemSummary } from '@open-design/contracts';

import { DesignSystemsTab } from '../../src/components/DesignSystemsTab';

const originalIntersectionObserver = globalThis.IntersectionObserver;

class IdleIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  globalThis.IntersectionObserver =
    IdleIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

function ds(
  overrides: Partial<DesignSystemSummary> & Pick<DesignSystemSummary, 'id' | 'title'>,
): DesignSystemSummary {
  return {
    id: overrides.id,
    title: overrides.title,
    category: overrides.category ?? 'Uncategorized',
    summary: overrides.summary ?? `${overrides.title} summary`,
    surface: overrides.surface ?? 'web',
  };
}

const librarySystems: DesignSystemSummary[] = [
  ds({ id: 'retro-web-1', title: 'Retro Web One', category: 'Retro', surface: 'web' }),
  ds({ id: 'retro-web-2', title: 'Retro Web Two', category: 'Retro', surface: 'web' }),
  ds({ id: 'retro-img-1', title: 'Retro Image One', category: 'Retro', surface: 'image' }),
  ds({ id: 'social-web-1', title: 'Social Web One', category: 'Social', surface: 'web' }),
  ds({ id: 'social-img-1', title: 'Social Image One', category: 'Social', surface: 'image' }),
];

function renderTab(items: readonly DesignSystemSummary[] = librarySystems) {
  return render(
    <DesignSystemsTab
      systems={[...items]}
      selectedId={null}
      onSelect={vi.fn()}
      onPreview={vi.fn()}
    />,
  );
}

function surfacePillCount(label: string): string | null {
  for (const pill of screen.getAllByRole('tab')) {
    const countEl = pill.querySelector('.filter-pill-count');
    const labelText = (pill.textContent ?? '').replace(countEl?.textContent ?? '', '');
    if (labelText === label) return countEl?.textContent ?? null;
  }
  return null;
}

function selectCategory(value: string) {
  fireEvent.change(screen.getByTestId('design-systems-category-select'), {
    target: { value },
  });
}

describe('DesignSystemsTab surface filtering', () => {
  it('scopes surface pill counts to the selected style category', () => {
    renderTab();

    expect(surfacePillCount('All')).toBe('5');
    expect(surfacePillCount('Web')).toBe('3');
    expect(surfacePillCount('Image')).toBe('2');

    selectCategory('Retro');

    expect(surfacePillCount('All')).toBe('3');
    expect(surfacePillCount('Web')).toBe('2');
    expect(surfacePillCount('Image')).toBe('1');
  });

  it('keeps the style category when a surface chip refines within it', () => {
    renderTab();
    selectCategory('Retro');

    fireEvent.click(screen.getByRole('tab', { name: /^Web/ }));

    expect(
      (screen.getByTestId('design-systems-category-select') as HTMLSelectElement).value,
    ).toBe('Retro');
    expect(screen.getByText('Retro Web One')).toBeTruthy();
    expect(screen.getByText('Retro Web Two')).toBeTruthy();
    expect(screen.queryByText('Social Web One')).toBeNull();
  });

  it('hides a surface chip that has no systems in the selected style category', () => {
    const webOnlyCategory: DesignSystemSummary[] = [
      ds({ id: 'tools-web-1', title: 'Tools Web One', category: 'Tools', surface: 'web' }),
      ds({ id: 'retro-web-1', title: 'Retro Web One', category: 'Retro', surface: 'web' }),
      ds({ id: 'retro-img-1', title: 'Retro Image One', category: 'Retro', surface: 'image' }),
    ];
    renderTab(webOnlyCategory);
    expect(screen.queryByRole('tab', { name: /^Image/ })).not.toBeNull();

    selectCategory('Tools');

    expect(screen.queryByRole('tab', { name: /^Image/ })).toBeNull();
    expect(surfacePillCount('Web')).toBe('1');
  });

  it('keeps the active surface chip visible when a search filters out all of its results', () => {
    renderTab();
    fireEvent.click(screen.getByRole('tab', { name: /^Image/ }));

    fireEvent.change(screen.getByTestId('design-systems-search'), {
      target: { value: 'Web' },
    });

    const imageTab = screen.queryByRole('tab', { name: /^Image/ });
    expect(imageTab).not.toBeNull();
    expect(imageTab?.getAttribute('aria-selected')).toBe('true');
    expect(surfacePillCount('Image')).toBe('0');
  });
});
