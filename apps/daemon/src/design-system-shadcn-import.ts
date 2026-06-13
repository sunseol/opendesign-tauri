import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

import {
  LocalDesignSystemImportError,
  type LocalDesignSystemImportResult,
  importLocalDesignSystemProject,
} from './design-system-import.js';
import {
  resolveShadcnItem,
} from './design-system-shadcn-fetch.js';
import { defaultShadcnFetch, withFetchBudget } from './design-system-shadcn-http.js';
import {
  cleanShadcnName,
  materializeShadcnItem,
  renderShadcnSourceCss,
  wrapShadcnColorValue,
} from './design-system-shadcn-materialize.js';
import { parseShadcnReference } from './design-system-shadcn-reference.js';
import type { ShadcnDesignSystemImportOptions } from './design-system-shadcn-types.js';

export { parseShadcnReference, renderShadcnSourceCss, wrapShadcnColorValue };
export type {
  ParsedShadcnReference,
  ShadcnDesignSystemImportOptions,
  ShadcnFetch,
  ShadcnFetchResponse,
} from './design-system-shadcn-types.js';

export async function importShadcnDesignSystemProject(
  reference: string,
  tmpRoot: string,
  userDesignSystemsRoot: string,
  options: ShadcnDesignSystemImportOptions = {},
): Promise<LocalDesignSystemImportResult> {
  const fetchImpl = withFetchBudget(options.fetchImpl ?? defaultShadcnFetch());
  const parsed = parseShadcnReference(reference);
  const importedAt = (options.now ?? new Date()).toISOString();
  const resolved = await resolveShadcnItem(parsed, fetchImpl);
  const item = resolved.item;
  const itemName = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : undefined;
  const hasFiles = Array.isArray(item.files) && item.files.length > 0;
  if (!itemName && !item.cssVars && !hasFiles) {
    throw new LocalDesignSystemImportError(
      'BAD_REQUEST',
      'shadcn reference did not resolve to a usable registry item (no name, cssVars, or files)',
    );
  }

  const materializeRoot = path.join(tmpRoot, 'shadcn-design-system-imports');
  await mkdir(materializeRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(materializeRoot, 'item-'));

  try {
    await materializeShadcnItem(item, tempDir, resolved, fetchImpl);
    const fallbackName = cleanShadcnName(item.title ?? itemName ?? 'shadcn design system');
    return await importLocalDesignSystemProject(tempDir, userDesignSystemsRoot, {
      now: new Date(importedAt),
      fallbackName,
      ...(options.name ? { name: options.name } : {}),
      ...(options.reservedIds ? { reservedIds: options.reservedIds } : {}),
      ...(options.importMode ? { importMode: options.importMode } : {}),
      ...(options.craftApplies ? { craftApplies: options.craftApplies } : {}),
      source: {
        type: 'shadcn',
        reference,
        registryUrl: resolved.registryUrl,
        importedAt,
        ...(itemName ? { item: itemName } : {}),
        ...(resolved.homepage ? { homepage: resolved.homepage } : {}),
      },
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
