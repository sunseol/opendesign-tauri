export type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export type NewsletterEnv = {
  NEWSLETTER_SALT?: string;
  NEWSLETTER_SUBSCRIBERS?: KVNamespace;
  RESEND_API_KEY?: string;
  RESEND_NEWSLETTER_SEGMENT_ID?: string;
  RESEND_WELCOME_EMAIL_ENABLED?: string;
  RESEND_WELCOME_EMAIL_FROM?: string;
  RESEND_WELCOME_EMAIL_REPLY_TO?: string;
};

export type PagesFunctionContext<Env> = {
  readonly env: Env;
  readonly request: Request & { readonly cf?: Record<string, unknown> };
  waitUntil(promise: Promise<unknown>): void;
};

export type PagesFunction<Env> = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export type SubscribeRecord = {
  readonly email: string;
  readonly referer: string | null;
  readonly source: string;
  readonly subscribedAt: string;
  readonly userAgentHash: string;
  readonly country?: string;
  readonly region?: string;
  readonly welcomeEmailAttemptedAt?: string;
  readonly welcomeEmailId?: string;
  readonly welcomeEmailSentAt?: string;
};

export type Fetcher = typeof fetch;
