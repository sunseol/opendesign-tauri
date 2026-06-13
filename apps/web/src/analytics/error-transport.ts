export interface ExceptionTrackingContext {
  readonly apiKey: string;
  readonly host: string;
  readonly distinctId: string;
  readonly appVersion?: string;
  readonly sessionId?: string;
  readonly telemetryEnv?: string;
}

interface BufferedSafetyEvent {
  readonly eventName: string;
  readonly properties: Record<string, unknown>;
  readonly timestamp: string;
}

const MAX_BUFFER_SIZE = 50;

let context: ExceptionTrackingContext | null = null;
const buffer: BufferedSafetyEvent[] = [];

export function setExceptionTrackingContext(
  next: ExceptionTrackingContext,
): void {
  context = next;
  if (buffer.length === 0) return;
  const drain = buffer.splice(0, buffer.length);
  for (const item of drain) dispatch(item);
}

export function clearExceptionTrackingContext(): void {
  context = null;
  buffer.splice(0, buffer.length);
}

export function enqueueSafetyEvent(
  eventName: string,
  properties: Record<string, unknown>,
): void {
  const item: BufferedSafetyEvent = {
    eventName,
    properties,
    timestamp: new Date().toISOString(),
  };
  if (context == null) {
    if (buffer.length >= MAX_BUFFER_SIZE) buffer.shift();
    buffer.push(item);
    return;
  }
  dispatch(item);
}

function dispatch(item: BufferedSafetyEvent): void {
  if (context == null) return;
  const payload = {
    api_key: context.apiKey,
    event: item.eventName,
    distinct_id: context.distinctId,
    properties: {
      ...item.properties,
      $lib: 'web/error-tracking',
      ...(context.telemetryEnv ? { env: context.telemetryEnv } : {}),
      ...(context.appVersion
        ? { app_version: context.appVersion, ui_version: context.appVersion }
        : {}),
      ...(context.sessionId ? { session_id: context.sessionId } : {}),
    },
    timestamp: item.timestamp,
  };
  try {
    void fetch(`${context.host.replace(/\/+$/, '')}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
    });
  } catch {
  }
}
