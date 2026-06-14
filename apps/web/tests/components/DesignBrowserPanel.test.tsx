// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesignBrowserPanel } from '../../src/components/DesignBrowserPanel';
import { writeProjectTextFile } from '../../src/providers/registry';

vi.mock('../../src/providers/registry', () => ({
  writeProjectTextFile: vi.fn(),
}));

const mockedWriteProjectTextFile = vi.mocked(writeProjectTextFile);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('DesignBrowserPanel', () => {
  it('opens Reference Board sites and persists them as browser history', () => {
    const onPageInfoChange = vi.fn();

    renderBrowserPanel({ projectId: 'proj-browser', onPageInfoChange });
    fireEvent.click(screen.getByRole('button', { name: 'Open Dribbble' }));

    const address = screen.getByRole('textbox', { name: 'Browser address' });
    if (!(address instanceof HTMLInputElement)) throw new TypeError('Expected browser address input');
    expect(address.value).toBe('https://dribbble.com/');
    expect(screen.getByRole('button', { name: 'Reopen Dribbble' })).toBeTruthy();
    expect(onPageInfoChange).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Dribbble',
      url: 'https://dribbble.com/',
    }));
  });

  it('normalizes typed addresses and restores saved history for the same project', () => {
    renderBrowserPanel({ projectId: 'proj-history' });
    const address = screen.getByRole('textbox', { name: 'Browser address' });
    fireEvent.change(address, { target: { value: 'localhost:3000/demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open address' }));
    cleanup();

    renderBrowserPanel({ projectId: 'proj-history' });

    expect(screen.getByRole('button', { name: 'Reopen localhost' })).toBeTruthy();
  });

  it('keeps blank and unsafe initial targets on the Reference Board home', () => {
    renderBrowserPanel({ initialUrl: 'mailto:hi@example.com' });

    const address = screen.getByRole('textbox', { name: 'Browser address' });
    if (!(address instanceof HTMLInputElement)) throw new TypeError('Expected browser address input');
    expect(address.value).toBe('');
    expect(screen.getByTestId('design-browser-reference-board')).toBeTruthy();
  });

  it('saves the current page brief into project files and opens it', async () => {
    const onRefreshFiles = vi.fn();
    const onOpenFile = vi.fn();
    mockedWriteProjectTextFile.mockResolvedValue({
      name: 'browser/browser-brief-dribbble.md',
      path: 'browser/browser-brief-dribbble.md',
      type: 'file',
      size: 100,
      mtime: 1,
      kind: 'text',
      mime: 'text/markdown',
    });

    renderBrowserPanel({ projectId: 'proj-capture', onRefreshFiles, onOpenFile });
    fireEvent.click(screen.getByRole('button', { name: 'Open Dribbble' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save brief' }));

    await expect.poll(() => mockedWriteProjectTextFile.mock.calls.length).toBe(1);
    const call = mockedWriteProjectTextFile.mock.calls[0];
    if (!call) throw new Error('Expected writeProjectTextFile call');
    expect(call[0]).toBe('proj-capture');
    expect(call[1]).toMatch(/^browser\/browser-brief-dribbble\.com-[\dTZ-]+\.md$/);
    expect(call[2]).toContain('# Dribbble');
    expect(call[2]).toContain('Source: https://dribbble.com/');
    expect(onRefreshFiles).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledWith('browser/browser-brief-dribbble.md');
  });
});

function renderBrowserPanel(overrides: Partial<React.ComponentProps<typeof DesignBrowserPanel>> = {}) {
  return render(
    <DesignBrowserPanel
      projectId="project-1"
      onOpenFile={vi.fn()}
      onRefreshFiles={vi.fn()}
      {...overrides}
    />,
  );
}
