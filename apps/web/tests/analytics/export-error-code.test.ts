import { describe, expect, it } from 'vitest';

import { exportErrorCode } from '../../src/analytics/export-error-code';

describe('exportErrorCode', () => {
  it('classifies daemon desktop sidecar version skew from its wrapped message', () => {
    // Given: the daemon wraps an older desktop rejecting the render-slides message.
    const err = new Error(
      'desktop renderer unavailable: unknown desktop sidecar message: render-slides',
    );

    // When: export analytics classifies the thrown failure.
    const code = exportErrorCode(err);

    // Then: analytics receives a stable code instead of generic Error.
    expect(code).toBe('DESKTOP_SIDECAR_UNKNOWN_MESSAGE');
  });

  it('classifies plain renderer unavailability separately from version skew', () => {
    // Given: the renderer is unavailable for a non-sidecar-message reason.
    const err = new Error('desktop renderer unavailable: connection refused');

    // When: export analytics classifies the thrown failure.
    const code = exportErrorCode(err);

    // Then: analytics keeps it separate from sidecar version skew.
    expect(code).toBe('DESKTOP_RENDERER_UNAVAILABLE');
  });

  it('prefers structured error codes over message classification', () => {
    // Given: a future typed error already carries its own stable code.
    const err = Object.assign(
      new Error('desktop renderer unavailable: unknown desktop sidecar message: render-slides'),
      { code: 'UPSTREAM_UNAVAILABLE' },
    );

    // When: export analytics classifies the thrown failure.
    const code = exportErrorCode(err);

    // Then: the typed code wins.
    expect(code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('falls back to the error name for unclassified failures', () => {
    // Given: ordinary errors with no known export-runtime signature.
    const typeError = new TypeError('boom');
    const genericError = new Error('export request failed (500)');

    // When: export analytics classifies them.
    const typeCode = exportErrorCode(typeError);
    const genericCode = exportErrorCode(genericError);

    // Then: existing error-name behavior is preserved as the fallback.
    expect(typeCode).toBe('TypeError');
    expect(genericCode).toBe('Error');
  });

  it('returns UNKNOWN for non-Error throwables', () => {
    // Given: JavaScript allows throwing arbitrary values.
    const textThrowable = 'nope';
    const emptyThrowable = undefined;

    // When: export analytics classifies non-Error failures.
    const textCode = exportErrorCode(textThrowable);
    const emptyCode = exportErrorCode(emptyThrowable);

    // Then: analytics receives a stable unknown bucket.
    expect(textCode).toBe('UNKNOWN');
    expect(emptyCode).toBe('UNKNOWN');
  });
});
