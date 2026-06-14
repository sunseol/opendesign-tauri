import type { Fetcher, NewsletterEnv, SubscribeRecord } from './types.ts';

const RESEND_CONTACTS_URL = 'https://api.resend.com/contacts';
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const DEFAULT_WELCOME_EMAIL_FROM = 'Open Design <updates@open-design.ai>';
const DEFAULT_WELCOME_EMAIL_REPLY_TO = 'updates@open-design.ai';
const WELCOME_EMAIL_SUBJECT = 'Welcome to Open Design';
const WELCOME_EMAIL_TEXT = `Hi there,

Thanks for subscribing to the Open Design newsletter. You're officially on the list.

Expect product updates, design system notes, and behind-the-scenes lessons from the team.

Talk soon,
The Open Design Team`;
const WELCOME_EMAIL_HTML = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f2e7;color:#171511;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:40px 24px;">
      <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;color:#171511;">Welcome to Open Design</h1>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hi there,</p>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Thanks for subscribing to the Open Design newsletter. You're officially on the list.</p>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Expect product updates, design system notes, and behind-the-scenes lessons from the team.</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">Talk soon,<br>The Open Design Team</p>
    </div>
  </body>
</html>`;

function isExistingContactStatus(status: number): boolean {
  return status === 409 || status === 422;
}

async function createResendContact(
  apiKey: string,
  email: string,
  segmentId: string | null,
  fetcher: Fetcher,
): Promise<Response> {
  const body: {
    email: string;
    segments?: Array<{ id: string }>;
    unsubscribed: false;
  } = {
    email,
    unsubscribed: false,
  };

  if (segmentId) body.segments = [{ id: segmentId }];

  return fetcher(RESEND_CONTACTS_URL, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

async function addResendContactToSegment(
  apiKey: string,
  email: string,
  segmentId: string,
  fetcher: Fetcher,
): Promise<Response> {
  return fetcher(`${RESEND_CONTACTS_URL}/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function syncResendNewsletterContact(
  apiKey: string | undefined,
  segmentId: string | undefined,
  email: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  if (!apiKey) {
    console.warn('newsletter_resend_unset: RESEND_API_KEY missing; skipped Resend, KV only');
    return;
  }

  const normalizedSegmentId = segmentId?.trim() || null;
  if (!normalizedSegmentId) {
    console.warn('newsletter_resend_segment_unset: RESEND_NEWSLETTER_SEGMENT_ID missing; contact will not be grouped');
  }

  try {
    const createResponse = await createResendContact(apiKey, email, normalizedSegmentId, fetcher);
    if (createResponse.ok) return;

    if (isExistingContactStatus(createResponse.status)) {
      if (!normalizedSegmentId) return;

      const segmentResponse = await addResendContactToSegment(apiKey, email, normalizedSegmentId, fetcher);
      if (segmentResponse.ok || isExistingContactStatus(segmentResponse.status)) return;

      console.warn('newsletter_resend_segment_failed', JSON.stringify({ status: segmentResponse.status }));
      return;
    }

    console.warn('newsletter_resend_contact_failed', JSON.stringify({ status: createResponse.status }));
  } catch (error) {
    if (error instanceof Error) {
      console.warn('newsletter_resend_request_failed');
      return;
    }
    throw error;
  }
}

function isWelcomeEmailEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off' && normalized !== 'no';
}

export function shouldAttemptWelcomeEmail(existingRecord: SubscribeRecord | null): boolean {
  if (existingRecord?.welcomeEmailSentAt) return false;
  if (!existingRecord) return true;
  return Boolean(existingRecord.welcomeEmailAttemptedAt);
}

export async function sendResendWelcomeEmail(
  env: NewsletterEnv,
  email: string,
  idempotencyKey: string,
  fetcher: Fetcher = fetch,
): Promise<{ readonly id?: string; readonly sentAt: string } | null> {
  if (!isWelcomeEmailEnabled(env.RESEND_WELCOME_EMAIL_ENABLED)) return null;

  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('newsletter_welcome_resend_unset: RESEND_API_KEY missing; skipped welcome email');
    return null;
  }

  const from = env.RESEND_WELCOME_EMAIL_FROM?.trim() || DEFAULT_WELCOME_EMAIL_FROM;
  const replyTo = env.RESEND_WELCOME_EMAIL_REPLY_TO?.trim() || DEFAULT_WELCOME_EMAIL_REPLY_TO;

  try {
    const response = await fetcher(RESEND_EMAILS_URL, {
      body: JSON.stringify({
        from,
        html: WELCOME_EMAIL_HTML,
        reply_to: replyTo,
        subject: WELCOME_EMAIL_SUBJECT,
        tags: [
          { name: 'type', value: 'newsletter_welcome' },
          { name: 'surface', value: 'landing_subscribe' },
        ],
        text: WELCOME_EMAIL_TEXT,
        to: email,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      method: 'POST',
    });

    if (!response.ok) {
      console.warn('newsletter_welcome_send_failed', JSON.stringify({ status: response.status }));
      return null;
    }

    const data: unknown = await response.json().catch((error: unknown) => {
      if (error instanceof Error) return {};
      throw error;
    });
    return {
      id: typeof Reflect.get(Object(data), 'id') === 'string' ? Reflect.get(Object(data), 'id') : undefined,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.warn('newsletter_welcome_request_failed');
      return null;
    }
    throw error;
  }
}
