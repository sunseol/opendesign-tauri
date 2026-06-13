import { LocalDesignSystemImportError } from './design-system-import.js';
import { fetchJsonDocument } from './design-system-shadcn-http.js';
import {
  DEFAULT_GITHUB_REFS,
  MAX_INCLUDE_BREADTH,
  MAX_INCLUDE_DEPTH,
  badShadcnReference,
  formatShadcnError,
  type ParsedShadcnReference,
  type RegistryItemMatch,
  type ResolvedShadcnItem,
  type ShadcnFetch,
  type ShadcnRegistry,
  type ShadcnRegistryItem,
} from './design-system-shadcn-types.js';

export async function resolveShadcnItem(
  parsed: ParsedShadcnReference,
  fetchImpl: ShadcnFetch,
): Promise<ResolvedShadcnItem> {
  if (parsed.kind === 'url') {
    return await resolveUrlReference(parsed.url, parsed.item, fetchImpl);
  }
  const refs = parsed.ref ? [parsed.ref] : DEFAULT_GITHUB_REFS;
  let lastError: unknown;
  for (const ref of refs) {
    const encodedRef = ref.split('/').map(encodeURIComponent).join('/');
    const registryUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodedRef}/registry.json`;
    try {
      const match = await locateItemInRegistry(registryUrl, parsed.item, fetchImpl, new Set(), 0);
      if (match) {
        const homepage = match.homepage ?? `https://github.com/${parsed.owner}/${parsed.repo}`;
        return {
          item: match.item,
          registryUrl,
          rawBaseUrl: registryFileDir(match.declaringUrl),
          homepage,
        };
      }
      lastError = badShadcnReference(
        `registry for ${parsed.owner}/${parsed.repo} has no item named "${parsed.item}"`,
      );
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LocalDesignSystemImportError) throw lastError;
  throw new LocalDesignSystemImportError(
    'BAD_REQUEST',
    `could not load registry.json for ${parsed.owner}/${parsed.repo}: ${formatShadcnError(lastError)}`,
  );
}

async function resolveUrlReference(
  url: string,
  itemName: string | undefined,
  fetchImpl: ShadcnFetch,
): Promise<ResolvedShadcnItem> {
  const doc = await fetchJsonDocument(url, fetchImpl);
  const registry = doc as ShadcnRegistry;
  const isIndex = Array.isArray(registry.items) || Array.isArray(registry.include);
  if (isIndex) {
    if (!itemName) {
      throw badShadcnReference('that URL is a registry index; append "#<item>" to choose an item');
    }
    const match = await locateItemInRegistry(url, itemName, fetchImpl, new Set(), 0);
    if (!match) throw badShadcnReference(`registry has no item named "${itemName}"`);
    return {
      item: match.item,
      registryUrl: url,
      rawBaseUrl: registryFileDir(match.declaringUrl),
      ...(match.homepage ? { homepage: match.homepage } : {}),
    };
  }
  const item = doc as ShadcnRegistryItem;
  if (!isUsableItem(item)) {
    throw badShadcnReference('URL did not return a shadcn registry item');
  }
  return {
    item,
    registryUrl: url,
    rawBaseUrl: registryFileDir(url),
    ...(typeof item.homepage === 'string' ? { homepage: item.homepage } : {}),
  };
}

async function locateItemInRegistry(
  registryUrl: string,
  itemName: string,
  fetchImpl: ShadcnFetch,
  visited: Set<string>,
  depth: number,
  inheritedHomepage?: string,
): Promise<RegistryItemMatch | undefined> {
  if (depth > MAX_INCLUDE_DEPTH || visited.has(registryUrl)) return undefined;
  visited.add(registryUrl);

  const registry = (await fetchJsonDocument(registryUrl, fetchImpl)) as ShadcnRegistry;
  const homepage =
    inheritedHomepage ?? (typeof registry.homepage === 'string' ? registry.homepage : undefined);
  const item = Array.isArray(registry.items)
    ? registry.items.find((entry) => entry?.name === itemName)
    : undefined;
  if (item) return { item, declaringUrl: registryUrl, ...(homepage ? { homepage } : {}) };

  if (!Array.isArray(registry.include)) return undefined;
  if (registry.include.length > MAX_INCLUDE_BREADTH) {
    throw badShadcnReference(
      `registry at ${registryUrl} declares ${registry.include.length} includes, exceeding the ${MAX_INCLUDE_BREADTH}-include limit`,
    );
  }
  for (const entry of registry.include) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const includedUrl = includedRegistryUrl(entry, registryUrl);
    if (!includedUrl) continue;
    const match = await locateItemInRegistry(includedUrl, itemName, fetchImpl, visited, depth + 1, homepage);
    if (match) return match;
  }
  return undefined;
}

function includedRegistryUrl(entry: string, registryUrl: string): string | undefined {
  try {
    return new URL(entry, registryUrl).toString();
  } catch {
    return undefined;
  }
}

function registryFileDir(url: string): string {
  try {
    return new URL('.', url).toString().replace(/\/+$/, '');
  } catch {
    return url.replace(/\/[^/]*$/, '');
  }
}

function isUsableItem(item: unknown): item is ShadcnRegistryItem {
  if (typeof item !== 'object' || item === null) return false;
  const candidate = item as ShadcnRegistryItem;
  return (
    typeof candidate.name === 'string' ||
    candidate.cssVars !== undefined ||
    Array.isArray(candidate.files)
  );
}
