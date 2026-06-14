// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesignBrowserReferenceBoard } from '../../src/components/DesignBrowserReferenceBoard';

afterEach(() => {
  cleanup();
});

describe('DesignBrowserReferenceBoard', () => {
  it('renders reference categories and opens a selected reference', () => {
    const onOpenReference = vi.fn();

    render(<DesignBrowserReferenceBoard onOpenReference={onOpenReference} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Dribbble' }));

    expect(screen.getByRole('tab', { name: /All 80/u })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search references' })).toBeTruthy();
    expect(onOpenReference).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Dribbble',
      url: 'https://dribbble.com/',
    }));
  });

  it('filters references by search query and clears empty results', () => {
    render(<DesignBrowserReferenceBoard onOpenReference={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Search references' });

    fireEvent.change(search, { target: { value: 'COOLORS' } });
    expect(screen.getByText('Coolors')).toBeTruthy();
    expect(screen.queryByText('Dribbble')).toBeNull();

    fireEvent.change(search, { target: { value: 'zzz-no-such-reference' } });
    expect(screen.getByRole('status').textContent).toContain('No references match');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    if (!(search instanceof HTMLInputElement)) throw new TypeError('Expected searchbox input');
    expect(search.value).toBe('');
    expect(screen.getByText('Dribbble')).toBeTruthy();
  });

  it('narrows references with category tabs', () => {
    render(<DesignBrowserReferenceBoard onOpenReference={vi.fn()} />);
    const motionTab = screen.getByRole('tab', { name: /Motion 7/u });

    fireEvent.click(motionTab);

    expect(motionTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('GSAP')).toBeTruthy();
    expect(screen.getByText('Motion.page Showcase')).toBeTruthy();
    expect(screen.queryByText('Coolors')).toBeNull();
  });
});
