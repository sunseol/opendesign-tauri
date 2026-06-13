import type { Request } from 'express';
import { createApiError, type ApiError } from '@open-design/contracts';
import type { RouteInputContext } from './types.js';

export function rawInput(req: Request): RouteInputContext {
  return {
    body: req.body,
    query: queryRecord(req.query),
    params: paramsRecord(req.params),
  };
}

export function validationError(
  message: string,
  issues: Array<{ path: string; message: string }> = [],
): ApiError {
  if (issues.length === 0) return createApiError('BAD_REQUEST', message);
  const details = {
    kind: 'validation',
    issues,
  } satisfies NonNullable<ApiError['details']>;
  return createApiError('BAD_REQUEST', message, { details });
}

function queryRecord(query: Request['query']): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    record[key] = value;
  }
  return record;
}

function paramsRecord(params: Request['params']): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string') record[key] = value;
  }
  return record;
}
