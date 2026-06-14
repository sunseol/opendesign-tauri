import { sendResendWelcomeEmail, shouldAttemptWelcomeEmail, syncResendNewsletterContact } from './resend.ts';
import type { Fetcher, KVNamespace, NewsletterEnv, SubscribeRecord } from './types.ts';

function isSubscribeRecord(value: unknown): value is SubscribeRecord {
  if (typeof value !== 'object' || value === null) return false;

  const attemptedAt = Reflect.get(value, 'welcomeEmailAttemptedAt');
  const emailId = Reflect.get(value, 'welcomeEmailId');
  const sentAt = Reflect.get(value, 'welcomeEmailSentAt');

  return (
    typeof Reflect.get(value, 'email') === 'string' &&
    (typeof Reflect.get(value, 'referer') === 'string' || Reflect.get(value, 'referer') === null) &&
    typeof Reflect.get(value, 'source') === 'string' &&
    typeof Reflect.get(value, 'subscribedAt') === 'string' &&
    typeof Reflect.get(value, 'userAgentHash') === 'string' &&
    (attemptedAt === undefined || typeof attemptedAt === 'string') &&
    (emailId === undefined || typeof emailId === 'string') &&
    (sentAt === undefined || typeof sentAt === 'string')
  );
}

async function writeNewsletterKv(
  namespace: KVNamespace | undefined,
  key: string,
  record: SubscribeRecord,
): Promise<void> {
  if (namespace) {
    await namespace.put(key, JSON.stringify(record));
    return;
  }

  console.warn(
    'newsletter_subscribe_kv_unbound: NEWSLETTER_SUBSCRIBERS binding missing; subscription dropped',
    JSON.stringify({ country: record.country, key, source: record.source }),
  );
}

async function readNewsletterKv(namespace: KVNamespace | undefined, key: string): Promise<SubscribeRecord | null> {
  if (!namespace) return null;

  const value = await namespace.get(key);
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isSubscribeRecord(parsed)) return null;
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn('newsletter_subscribe_kv_invalid_record', JSON.stringify({ key }));
      return null;
    }
    throw error;
  }
}

export async function persistNewsletterSubscription(
  env: NewsletterEnv,
  key: string,
  record: SubscribeRecord,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const existingRecord = await readNewsletterKv(env.NEWSLETTER_SUBSCRIBERS, key);
  const canDeduplicateWelcome = Boolean(env.NEWSLETTER_SUBSCRIBERS);
  const attemptWelcome = canDeduplicateWelcome && shouldAttemptWelcomeEmail(existingRecord);
  const welcomeAttemptedAt = attemptWelcome ? new Date().toISOString() : undefined;
  const nextRecord: SubscribeRecord = {
    ...existingRecord,
    ...record,
    welcomeEmailAttemptedAt: welcomeAttemptedAt ?? existingRecord?.welcomeEmailAttemptedAt,
    welcomeEmailId: existingRecord?.welcomeEmailId,
    welcomeEmailSentAt: existingRecord?.welcomeEmailSentAt,
  };

  await writeNewsletterKv(env.NEWSLETTER_SUBSCRIBERS, key, nextRecord);

  await syncResendNewsletterContact(env.RESEND_API_KEY, env.RESEND_NEWSLETTER_SEGMENT_ID, record.email, fetcher);

  if (!attemptWelcome) return;

  const welcomeResult = await sendResendWelcomeEmail(env, record.email, `newsletter-welcome-${key}`, fetcher);
  if (!welcomeResult) return;

  await writeNewsletterKv(env.NEWSLETTER_SUBSCRIBERS, key, {
    ...nextRecord,
    welcomeEmailId: welcomeResult.id,
    welcomeEmailSentAt: welcomeResult.sentAt,
  });
}
