const ALLOWED_ORIGINS = [
  'https://open-design.ai',
  'https://www.open-design.ai',
  'od://app',
  'tauri://localhost',
  'http://localhost',
  'http://127.0.0.1',
] as const;

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.some((allowedOrigin) => origin === allowedOrigin || origin.startsWith(`${allowedOrigin}:`))
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
    status,
  });
}
