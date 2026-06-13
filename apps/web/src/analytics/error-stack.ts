export interface CaptureMetadata {
  readonly filename?: string;
  readonly lineno?: number;
  readonly colno?: number;
  readonly handled?: boolean;
}

const STACK_RE_V8 = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/;
const STACK_RE_SPIDERMONKEY = /^(.*?)@(.+?):(\d+):(\d+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function buildExceptionList(
  error: unknown,
  fallbackMessage: string,
  metadata: CaptureMetadata,
): Array<Record<string, unknown>> {
  const isError = error instanceof Error;
  const type = isError ? error.name : typeof error === 'string' ? 'Error' : 'NonError';
  const value = isError
    ? error.message
    : typeof error === 'string'
      ? error
      : fallbackMessage;
  const stack = isError && typeof error.stack === 'string' ? error.stack : '';
  return [
    {
      type,
      value,
      stacktrace: { type: 'raw', frames: parseStack(stack, metadata) },
      mechanism: {
        type: metadata.handled === true ? 'handled' : 'generic',
        handled: metadata.handled === true,
      },
    },
  ];
}

function parseStack(
  stack: string,
  metadata: CaptureMetadata,
): Array<Record<string, unknown>> {
  if (!stack) {
    return metadata.filename
      ? [{
          function: '<anonymous>',
          filename: metadata.filename,
          abs_path: metadata.filename,
          lineno: metadata.lineno ?? 0,
          colno: metadata.colno ?? 0,
          in_app: true,
        }]
      : [];
  }
  const lines = stack.split('\n');
  const frameLines = lines[0]?.match(/^\s*at\b|@/) ? lines : lines.slice(1);
  return frameLines
    .map((line) => parseFrame(line))
    .filter((frame): frame is Record<string, unknown> => frame != null);
}

function parseFrame(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const v8 = STACK_RE_V8.exec(trimmed);
  if (v8) {
    return {
      function: v8[1] ?? '<anonymous>',
      filename: v8[2],
      abs_path: v8[2],
      lineno: Number(v8[3]),
      colno: Number(v8[4]),
      in_app: true,
    };
  }
  const sm = STACK_RE_SPIDERMONKEY.exec(trimmed);
  if (sm) {
    return {
      function: sm[1] || '<anonymous>',
      filename: sm[2],
      abs_path: sm[2],
      lineno: Number(sm[3]),
      colno: Number(sm[4]),
      in_app: true,
    };
  }
  return { raw: trimmed, in_app: true };
}

export function firstFrameSource(
  list: Array<Record<string, unknown>>,
): string | undefined {
  const first = list[0];
  if (!isRecord(first?.stacktrace)) return undefined;
  const frames = first.stacktrace.frames;
  if (!Array.isArray(frames) || !isRecord(frames[0])) return undefined;
  const source = frames[0].abs_path;
  return typeof source === 'string' ? source : undefined;
}

export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export function defaultExceptionMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

export function randomInsertId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
