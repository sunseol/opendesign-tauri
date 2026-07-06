export function exportErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = err.code;
    if (typeof code === 'string' && code.length > 0) return code;
  }

  if (!(err instanceof Error)) return 'UNKNOWN';
  if (/unknown \w+ sidecar message/i.test(err.message)) return 'DESKTOP_SIDECAR_UNKNOWN_MESSAGE';
  if (/renderer (?:is )?unavailable/i.test(err.message)) return 'DESKTOP_RENDERER_UNAVAILABLE';
  return err.name || 'UNKNOWN';
}
