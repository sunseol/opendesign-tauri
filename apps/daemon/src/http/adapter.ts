import type { Express, Request, Response } from 'express';
import { createApiError } from '@open-design/contracts';
import { rawInput } from './parse.js';
import { sendApiError, sendJson, statusForError } from './response.js';
import { guardSameOrigin, type OriginContext } from './origin-guard.js';
import type { JsonRouteSpec } from './types.js';

export interface AdapterContext extends OriginContext {}

export function defineJsonRoute<Input, Output, Deps>(
  spec: JsonRouteSpec<Input, Output, Deps>,
): JsonRouteSpec<Input, Output, Deps> {
  return spec;
}

export function mountJsonRoute<Input, Output, Deps>(
  app: Express,
  spec: JsonRouteSpec<Input, Output, Deps>,
  deps: Deps,
  adapter: AdapterContext,
): void {
  const handler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (spec.requireSameOrigin === true) {
        const origin = guardSameOrigin(req, adapter);
        if (!origin.ok) {
          sendApiError(res, statusForError(origin.error), origin.error);
          return;
        }
      }

      const parsed = spec.parse(rawInput(req));
      if (!parsed.ok) {
        sendApiError(res, statusForError(parsed.error), parsed.error);
        return;
      }

      const result = await spec.handle(parsed.value, deps);
      if (!result.ok) {
        sendApiError(res, statusForError(result.error), result.error);
        return;
      }

      sendJson(res, spec.successStatus ?? 200, result.value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendApiError(res, 500, createApiError('INTERNAL_ERROR', message));
    }
  };

  switch (spec.method) {
    case 'get':
      app.get(spec.path, handler);
      break;
    case 'post':
      app.post(spec.path, handler);
      break;
    case 'put':
      app.put(spec.path, handler);
      break;
    case 'delete':
      app.delete(spec.path, handler);
      break;
    case 'patch':
      app.patch(spec.path, handler);
      break;
  }
}
