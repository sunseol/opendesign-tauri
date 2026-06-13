import {
  buildExceptionList,
  defaultExceptionMessage,
  firstFrameSource,
  randomInsertId,
  scrubUrl,
  type CaptureMetadata,
} from './error-stack';
import {
  clearExceptionTrackingContext,
  enqueueSafetyEvent,
  setExceptionTrackingContext,
  type ExceptionTrackingContext,
} from './error-transport';
import { scrubExceptionList, scrubFilePath } from './scrub';

export {
  clearExceptionTrackingContext,
  setExceptionTrackingContext,
  type ExceptionTrackingContext,
};

let installed = false;

export function installErrorHandlers(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    captureException(event.error, event.message ?? 'Uncaught error', {
      filename: typeof event.filename === 'string' ? event.filename : undefined,
      lineno: typeof event.lineno === 'number' ? event.lineno : undefined,
      colno: typeof event.colno === 'number' ? event.colno : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const fallback =
      typeof reason === 'string' ? reason : 'Unhandled promise rejection';
    captureException(reason, fallback);
  });
}

export function reportHandledException(error: unknown, message?: string): void {
  captureException(error, message ?? defaultExceptionMessage(error), {
    handled: true,
  });
}

export function reportSafetyEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
): void {
  enqueueSafetyEvent(eventName, {
    ...properties,
    $current_url: scrubUrl(typeof window !== 'undefined' ? window.location.href : ''),
    $insert_id: randomInsertId(),
    capture_source: 'web/error-tracking',
  });
}

function captureException(
  error: unknown,
  fallbackMessage: string,
  metadata: CaptureMetadata = {},
): void {
  const scrubbed = scrubExceptionList(
    buildExceptionList(error, fallbackMessage, metadata),
  );
  enqueueSafetyEvent('$exception', {
    $exception_list: scrubbed,
    $exception_type: scrubbed[0]?.type,
    $exception_message: scrubbed[0]?.value,
    $exception_source: firstFrameSource(scrubbed),
    $current_url: scrubUrl(typeof window !== 'undefined' ? window.location.href : ''),
    $insert_id: randomInsertId(),
    capture_source: 'web/error-tracking',
    handled: metadata.handled === true,
  });
}

export { scrubFilePath };
