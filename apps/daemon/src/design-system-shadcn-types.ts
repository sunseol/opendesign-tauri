import {
  LocalDesignSystemImportError,
  type LocalDesignSystemImportOptions,
} from './design-system-import.js';

export const FETCH_TIMEOUT_MS = 15_000;
export const OVERALL_TIMEOUT_MS = 60_000;
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_FILES = 100;
export const MAX_INCLUDE_DEPTH = 4;
export const MAX_INCLUDE_BREADTH = 100;
export const MAX_TOTAL_FETCHES = 200;
export const DEFAULT_GITHUB_REFS = ['main', 'master'] as const;
export const SHADCN_FILES_SUBDIR = 'registry-files';

export type ShadcnFetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  text(): Promise<string>;
  readonly headers?: { get(name: string): string | null };
  readonly body?: ReadableStream<Uint8Array> | null;
};

export type ShadcnFetch = (
  url: string,
  init?: { readonly signal?: AbortSignal },
) => Promise<ShadcnFetchResponse>;

export type ShadcnDesignSystemImportOptions = Pick<
  LocalDesignSystemImportOptions,
  'craftApplies' | 'importMode' | 'name' | 'now' | 'reservedIds'
> & {
  readonly fetchImpl?: ShadcnFetch;
};

export type ParsedShadcnReference =
  | { readonly kind: 'url'; readonly url: string; readonly item?: string }
  | {
    readonly kind: 'github';
    readonly owner: string;
    readonly repo: string;
    readonly item: string;
    readonly ref?: string;
  };

export type ShadcnCssVars = {
  readonly theme?: Record<string, unknown>;
  readonly light?: Record<string, unknown>;
  readonly dark?: Record<string, unknown>;
};

export type ShadcnRegistryFile = {
  readonly path?: string;
  readonly target?: string;
  readonly type?: string;
  readonly content?: string;
};

export type ShadcnRegistryItem = {
  readonly name?: string;
  readonly type?: string;
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
  readonly homepage?: string;
  readonly cssVars?: ShadcnCssVars;
  readonly dependencies?: unknown;
  readonly registryDependencies?: unknown;
  readonly files?: readonly ShadcnRegistryFile[];
};

export type ShadcnRegistry = {
  readonly name?: string;
  readonly homepage?: string;
  readonly items?: readonly ShadcnRegistryItem[];
  readonly include?: unknown;
};

export type RegistryItemMatch = {
  readonly item: ShadcnRegistryItem;
  readonly declaringUrl: string;
  readonly homepage?: string;
};

export type ResolvedShadcnItem = {
  readonly item: ShadcnRegistryItem;
  readonly registryUrl: string;
  readonly homepage?: string;
  readonly rawBaseUrl?: string;
};

export type HostClass = 'loopback' | 'blocked' | 'public';

export function badShadcnReference(message: string): LocalDesignSystemImportError {
  return new LocalDesignSystemImportError('BAD_REQUEST', message);
}

export function formatShadcnError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
