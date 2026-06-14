// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PreviewDrawOverlay } from '../../src/components/PreviewDrawOverlay';

afterEach(() => {
  cleanup();
});

describe('PreviewDrawOverlay send disabled localization', () => {
  it('keeps Send visible with its disabled reason and leaves Queue operable', () => {
    const { container } = render(
      <PreviewDrawOverlay active sendDisabled sendDisabledReason="Task running">
        <div data-testid="content" />
      </PreviewDrawOverlay>,
    );

    const note = document.querySelector('.preview-draw-note-input');
    if (!note) throw new Error('expected preview draw note input');
    fireEvent.change(note, { target: { value: 'looks good' } });

    const buttons = Array.from(container.querySelectorAll('button'));
    const send = buttons.find((button) => button.textContent === 'Send');
    const queue = buttons.find((button) => button.textContent === 'Queue');
    if (!send) throw new Error('expected disabled Send button to stay visible');
    if (!queue) throw new Error('expected Queue button');

    expect(send.getAttribute('title')).toBe('Task running');
    expect(send.disabled).toBe(true);
    expect(queue.disabled).toBe(false);
  });
});
