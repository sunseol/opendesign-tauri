// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignSystemSummary } from '@open-design/contracts';

import { DesignSystemsTab } from '../../src/components/DesignSystemsTab';
import { updateDesignSystemDraft } from '../../src/providers/registry';

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>(
    '../../src/providers/registry',
  );
  return {
    ...actual,
    fetchDesignSystemShowcase: vi.fn(async () => null),
    updateDesignSystemDraft: vi.fn(async () => null),
    deleteDesignSystemDraft: vi.fn(async () => true),
  };
});

// DesignSystemCard lazy-loads its showcase iframe through an
// IntersectionObserver; an idle observer keeps thumbnails (and the registry
// fetch) out of the way so the tests only exercise filtering.
const originalIntersectionObserver = globalThis.IntersectionObserver;

class IdleIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  globalThis.IntersectionObserver =
    IdleIntersectionObserver as unknown as typeof IntersectionObserver;
  vi.mocked(updateDesignSystemDraft).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const systems: DesignSystemSummary[] = [
  {
    id: 'user:acme',
    title: 'Acme Design System',
    category: 'Custom',
    summary: 'Internal product system.',
    surface: 'web',
    source: 'user',
    status: 'draft',
    isEditable: true,
    updatedAt: '2026-05-13T03:19:00.000Z',
  },
  {
    id: 'linear',
    title: 'Linear',
    category: 'Productivity & SaaS',
    summary: 'Quiet issue-tracker system.',
    surface: 'web',
    source: 'built-in',
    status: 'published',
    isEditable: false,
  },
];

describe('DesignSystemsTab', () => {
  it('surfaces user-created design systems in the gallery', () => {
    render(
      <DesignSystemsTab
        systems={systems}
        selectedId="user:acme"
        onSelect={() => {}}
        onPreview={() => {}}
        onCreate={() => {}}
        onOpenSystem={() => {}}
      />,
    );

    expect(screen.getByText('Create')).toBeTruthy();
    expect(screen.getByText('Acme Design System')).toBeTruthy();
    expect(screen.getByText('Linear')).toBeTruthy();
  });

  it('routes create and open actions to the dedicated design-system flow', () => {
    const onCreate = vi.fn();
    const onOpenSystem = vi.fn();
    render(
      <DesignSystemsTab
        systems={systems}
        selectedId={null}
        onSelect={() => {}}
        onPreview={() => {}}
        onCreate={onCreate}
        onOpenSystem={onOpenSystem}
      />,
    );

    fireEvent.click(screen.getByText('Create'));
    expect(onCreate).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByText('Edit'));
    expect(onOpenSystem).toHaveBeenCalledWith('user:acme');
  });

  it('renames editable design systems through the daemon-backed settings path', async () => {
    const onSystemsRefresh = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValue('Acme Studio System');
    render(
      <DesignSystemsTab
        systems={systems}
        selectedId={null}
        onSelect={() => {}}
        onPreview={() => {}}
        onCreate={() => {}}
        onOpenSystem={() => {}}
        onSystemsRefresh={onSystemsRefresh}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rename Acme Design System' }));

    await waitFor(() => {
      expect(updateDesignSystemDraft).toHaveBeenCalledWith('user:acme', {
        title: 'Acme Studio System',
      });
    });
    expect(onSystemsRefresh).toHaveBeenCalledOnce();
  });

  it('omits the built-in library Open button while keeping preview clicks', () => {
    const onOpenSystem = vi.fn();
    const onPreview = vi.fn();
    render(
      <DesignSystemsTab
        systems={systems}
        selectedId={null}
        onSelect={() => {}}
        onPreview={onPreview}
        onCreate={() => {}}
        onOpenSystem={onOpenSystem}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();

    fireEvent.click(screen.getByTestId('design-system-preview-linear'));

    expect(onPreview).toHaveBeenCalledWith('linear');
    expect(onOpenSystem).not.toHaveBeenCalledWith('linear');
  });
});
