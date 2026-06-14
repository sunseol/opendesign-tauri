import { corsHeaders, jsonResponse } from './_newsletter/cors.ts';
import { sha256Hex } from './_newsletter/hash.ts';
import { persistNewsletterSubscription } from './_newsletter/storage.ts';
import type { NewsletterEnv, PagesFunction, SubscribeRecord } from './_newsletter/types.ts';
import { shouldAttemptWelcomeEmail } from './_newsletter/resend.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const ALLOWED_SOURCES: ReadonlySet<string> = new Set(['landing', 'client']);

function property(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Reflect.get(value, key);
}

function sourceFromPayload(value: unknown): string {
  return typeof value === 'string' && ALLOWED_SOURCES.has(value) ? value : 'unknown';
}

export const onRequest: PagesFunction<NewsletterEnv> = async (context) => {
  const request = context.request;
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin), status: 204 });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', ok: false }, 405, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    if (error instanceof Error) return jsonResponse({ error: 'invalid_json', ok: false }, 400, origin);
    throw error;
  }

  const rawEmail = property(payload, 'email');
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'invalid_email', ok: false }, 400, origin);
  }

  const source = sourceFromPayload(property(payload, 'source'));
  const salt = context.env.NEWSLETTER_SALT || 'open-design-newsletter';
  const ip = request.headers.get('cf-connecting-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const cf = request.cf || {};
  const record: SubscribeRecord = {
    country: typeof cf.country === 'string' ? cf.country : undefined,
    email,
    referer: request.headers.get('referer'),
    region: typeof cf.region === 'string' ? cf.region : undefined,
    source,
    subscribedAt: new Date().toISOString(),
    userAgentHash: await sha256Hex(`${salt}:${ip}:${userAgent}`),
  };
  const key = `sub:${await sha256Hex(email)}`;

  context.waitUntil(persistNewsletterSubscription(context.env, key, record));

  return jsonResponse({ ok: true }, 200, origin);
};

export const __newsletterSubscribeTest = {
  corsHeaders,
  persistNewsletterSubscription,
  shouldAttemptWelcomeEmail,
};
