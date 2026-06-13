import { TextDecoder } from 'node:util';

import { LocalDesignSystemImportError } from './design-system-import.js';
import { assertFetchableUrl } from './design-system-shadcn-reference.js';
import {
  FETCH_TIMEOUT_MS,
  MAX_DOCUMENT_BYTES,
  MAX_TOTAL_FETCHES,
  OVERALL_TIMEOUT_MS,
  formatShadcnError,
  type ShadcnFetch,
  type ShadcnFetchResponse,
} from './design-system-shadcn-types.js';

export async function fetchJsonDocument(url: string, fetchImpl: ShadcnFetch): Promise<unknown> {
  const text = await fetchText(url, fetchImpl);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LocalDesignSystemImportError('BAD_REQUEST', `registry document at ${url} is not valid JSON`);
  }
}

export async function fetchText(url: string, fetchImpl: ShadcnFetch): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new LocalDesignSystemImportError('BAD_REQUEST', `invalid registry URL: ${url}`);
  }
  assertFetchableUrl(parsedUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await runFetch(url, fetchImpl, controller.signal);
    rejectOversizedDeclaredDocument(response, url);
    if (response.body && typeof response.body.getReader === 'function') {
      return await readBoundedStream(response.body, MAX_DOCUMENT_BYTES, url);
    }
    const text = await readResponseText(response, url);
    if (text.length > MAX_DOCUMENT_BYTES) throw oversizedDocument(url, MAX_DOCUMENT_BYTES);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function withFetchBudget(fetchImpl: ShadcnFetch): ShadcnFetch {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  let count = 0;
  return (url, init) => {
    if (Date.now() > deadline) {
      throw new LocalDesignSystemImportError('BAD_REQUEST', 'shadcn import exceeded its overall time budget');
    }
    count += 1;
    if (count > MAX_TOTAL_FETCHES) {
      throw new LocalDesignSystemImportError(
        'BAD_REQUEST',
        `shadcn import exceeded its ${MAX_TOTAL_FETCHES}-request budget`,
      );
    }
    return fetchImpl(url, init);
  };
}

export function defaultShadcnFetch(): ShadcnFetch {
  if (typeof fetch !== 'function') {
    throw new LocalDesignSystemImportError('INTERNAL_ERROR', 'global fetch is not available in this runtime');
  }
  return (url, init) => fetch(url, { ...init, redirect: 'error' });
}

async function runFetch(
  url: string,
  fetchImpl: ShadcnFetch,
  signal: AbortSignal,
): Promise<ShadcnFetchResponse> {
  try {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) {
      throw new LocalDesignSystemImportError(
        'BAD_REQUEST',
        `could not fetch ${url}: HTTP ${response.status} ${response.statusText}`.trimEnd(),
      );
    }
    return response;
  } catch (err) {
    if (err instanceof LocalDesignSystemImportError) throw err;
    if (isAbortError(err)) {
      throw new LocalDesignSystemImportError('BAD_REQUEST', `timed out fetching ${url}`);
    }
    throw new LocalDesignSystemImportError('BAD_REQUEST', `could not fetch ${url}: ${formatShadcnError(err)}`);
  }
}

function rejectOversizedDeclaredDocument(response: ShadcnFetchResponse, url: string): void {
  const declaredLength = Number(response.headers?.get('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES) {
    throw oversizedDocument(url, MAX_DOCUMENT_BYTES);
  }
}

async function readResponseText(response: ShadcnFetchResponse, url: string): Promise<string> {
  try {
    return await response.text();
  } catch (err) {
    if (isAbortError(err)) {
      throw new LocalDesignSystemImportError('BAD_REQUEST', `timed out reading ${url}`);
    }
    throw new LocalDesignSystemImportError('BAD_REQUEST', `could not read ${url}: ${formatShadcnError(err)}`);
  }
}

async function readBoundedStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  url: string,
): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw oversizedDocument(url, maxBytes);
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof LocalDesignSystemImportError) throw err;
    if (isAbortError(err)) {
      throw new LocalDesignSystemImportError('BAD_REQUEST', `timed out reading ${url}`);
    }
    throw new LocalDesignSystemImportError('BAD_REQUEST', `could not read ${url}: ${formatShadcnError(err)}`);
  }
  return new TextDecoder('utf-8').decode(mergeChunks(chunks, total));
}

function mergeChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function oversizedDocument(url: string, maxBytes: number): LocalDesignSystemImportError {
  return new LocalDesignSystemImportError(
    'BAD_REQUEST',
    `registry document at ${url} exceeds the ${maxBytes}-byte limit`,
  );
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { readonly name?: unknown }).name === 'AbortError';
}
