export const DEFAULT_OBJECT_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_OBJECT_PREFIX = 'observability';
export const DEFAULT_OBJECT_BATCH_MAX_BYTES = 20 * 1024 * 1024;
export const MAX_TOKEN_OBJECTS = 1000;
export const OBJECT_SCOPE_TTL_SECONDS = 10 * 60;
export const OBJECT_UPLOAD_TOKEN_TTL_SECONDS = 5 * 60;

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface R2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
}

export interface ObjectScopeBinding {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<unknown>;
}

export interface ObjectRelayEnv {
  TRACE_OBJECT_BUCKET?: R2BucketBinding;
  TRACE_OBJECT_BATCH_MAX_BYTES?: string;
  TRACE_OBJECT_MAX_BYTES?: string;
  TRACE_OBJECT_PREFIX?: string;
  TRACE_OBJECT_SCOPE_KV?: ObjectScopeBinding;
  TRACE_OBJECT_UPLOAD_SECRET?: string;
  TELEMETRY_CLIENT_RATE_LIMITER?: RateLimitBinding;
  TELEMETRY_IP_RATE_LIMITER?: RateLimitBinding;
}

export type ObjectClass = 'attachment' | 'artifact' | 'input_text_snapshot';

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export interface ObjectUploadScopeObject {
  readonly storage_ref: string;
  readonly object_class: ObjectClass;
  readonly size_bytes: number;
  readonly sha256: string;
}

export interface ObjectUploadTokenPayload {
  readonly version: 1;
  readonly client_id: string;
  readonly project_id: string;
  readonly run_id: string;
  readonly exp: number;
  readonly objects: readonly ObjectUploadScopeObject[];
}

export interface ObjectBatchObject {
  readonly storage_ref: string;
  readonly object_class: ObjectClass;
  readonly content_base64: string;
  readonly mime?: string;
}

export interface ObjectBatchBody {
  readonly client_id: string;
  readonly project_id: string;
  readonly run_id: string;
  readonly upload_token: string;
  readonly objects: readonly ObjectBatchObject[];
}
