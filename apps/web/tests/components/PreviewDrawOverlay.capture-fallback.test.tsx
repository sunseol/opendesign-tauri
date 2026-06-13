// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestPreviewSnapshotMock } = vi.hoisted(() => ({
  requestPreviewSnapshotMock: vi.fn(async () => null),
}));

vi.mock('../../src/runtime/exports', async () => {
  const actual = await vi.importActual<typeof import('../../src/runtime/exports')>(
    '../../src/runtime/exports',
  );
  return {
    ...actual,
    requestPreviewSnapshot: requestPreviewSnapshotMock,
  };
});

import { PreviewDrawOverlay } from '../../src/components/PreviewDrawOverlay';

let restoreCanvas: (() => void) | null = null;

beforeEach(() => {
  const rectSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 320,
      height: 200,
      right: 320,
      bottom: 200,
      toJSON: () => ({}),
    } as DOMRect);
  const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback: BlobCallback) => {
      callback(null);
    });
  restoreCanvas = () => {
    rectSpy.mockRestore();
    contextSpy.mockRestore();
    toBlobSpy.mockRestore();
  };
});

afterEach(() => {
  cleanup();
  requestPreviewSnapshotMock.mockClear();
  restoreCanvas?.();
  restoreCanvas = null;
});

function drawInk(canvas: HTMLCanvasElement) {
  fireEvent.pointerDown(canvas, { clientX: 40, clientY: 30, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: 220, clientY: 150, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 220, clientY: 150, pointerId: 1 });
}

describe('PreviewDrawOverlay capture fallback', () => {
  it('sends a typed annotation without a screenshot when preview capture fails', async () => {
    const annotation = vi.fn();
    window.addEventListener('opendesign:annotation', annotation);

    try {
      const { container, getByRole, getByText } = render(
        <PreviewDrawOverlay active>
          <iframe title="srcdoc" />
        </PreviewDrawOverlay>,
      );

      const canvas = container.querySelector<HTMLCanvasElement>('canvas');
      expect(canvas).toBeTruthy();
      drawInk(canvas!);

      const input = container.querySelector<HTMLInputElement>('.preview-draw-note-input');
      expect(input).toBeTruthy();
      fireEvent.change(input!, { target: { value: 'This section is missing its bar chart.' } });

      fireEvent.click(getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(annotation).toHaveBeenCalledTimes(1));
      expect(annotation.mock.calls[0]?.[0]).toMatchObject({
        detail: expect.objectContaining({
          action: 'send',
          note: 'This section is missing its bar chart.',
          file: null,
        }),
      });
      expect(getByText('Annotation sent without screenshot.')).toBeTruthy();
    } finally {
      window.removeEventListener('opendesign:annotation', annotation);
    }
  });

  it('blocks ink-only annotations when no screenshot can be produced', async () => {
    const annotation = vi.fn();
    window.addEventListener('opendesign:annotation', annotation);

    try {
      const { container, getByRole, getByText } = render(
        <PreviewDrawOverlay active>
          <iframe title="srcdoc" />
        </PreviewDrawOverlay>,
      );

      const canvas = container.querySelector<HTMLCanvasElement>('canvas');
      expect(canvas).toBeTruthy();
      drawInk(canvas!);

      fireEvent.click(getByRole('button', { name: 'Send' }));

      await waitFor(() =>
        expect(getByText('Could not capture the preview. Add a note or try again.')).toBeTruthy(),
      );
      expect(annotation).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('opendesign:annotation', annotation);
    }
  });
});
