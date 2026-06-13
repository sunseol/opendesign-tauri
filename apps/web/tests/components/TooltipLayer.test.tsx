// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipLayer } from '../../src/components/TooltipLayer';

afterEach(() => cleanup());

describe('TooltipLayer', () => {
  it('renders data-tooltip text for od-tooltip targets and restores native titles after hover', async () => {
    render(
      <>
        <button
          className="od-tooltip"
          data-tooltip="Open settings"
          data-tooltip-placement="bottom"
          title="Open settings"
          type="button"
        >
          Settings
        </button>
        <TooltipLayer />
      </>,
    );

    const trigger = screen.getByRole('button', { name: 'Settings' });

    fireEvent.pointerOver(trigger);

    expect(trigger.hasAttribute('title')).toBe(false);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Open settings');

    fireEvent.pointerOut(trigger);

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('title')).toBe('Open settings');
  });

  it('hides the tooltip while a popover target is expanded', async () => {
    render(
      <>
        <button
          aria-expanded="false"
          className="od-tooltip"
          data-tooltip="Current model"
          type="button"
        >
          Model
        </button>
        <TooltipLayer />
      </>,
    );

    const trigger = screen.getByRole('button', { name: 'Model' });
    fireEvent.pointerOver(trigger);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Current model');

    trigger.setAttribute('aria-expanded', 'true');

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});
