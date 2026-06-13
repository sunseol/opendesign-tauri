export const AIHUBMIX_APP_CODE = 'DMCY9912';
export const AIHUBMIX_DEFAULT_BASE_URL = 'https://aihubmix.com/v1';

export function aihubmixHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
  };
  if (AIHUBMIX_APP_CODE) {
    headers['APP-Code'] = AIHUBMIX_APP_CODE;
  }
  return headers;
}

export type AIHubMixCatalogType = 'llm' | 'image_generation' | 'tts' | 'video';

export function aihubmixCatalogUrl(baseUrl: string, type: AIHubMixCatalogType): string {
  let origin: string;
  try {
    origin = new URL(baseUrl || AIHUBMIX_DEFAULT_BASE_URL).origin;
  } catch {
    origin = 'https://aihubmix.com';
  }
  return `${origin}/api/v1/models?type=${type}`;
}

export interface AIHubMixCatalogModel {
  id: string;
  label: string;
}

const AIHUBMIX_MEDIA_GENERATION_TYPES = new Set(['image_generation', 'video', 'tts']);

function aihubmixRowTypes(row: unknown): string[] {
  const raw = (row as { types?: unknown })?.types;
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);
}

export interface ParseAIHubMixCatalogOptions {
  chatOnly?: boolean;
}

export function parseAIHubMixCatalog(
  data: unknown,
  options?: ParseAIHubMixCatalogOptions,
): AIHubMixCatalogModel[] {
  const rows = (data as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: AIHubMixCatalogModel[] = [];
  for (const row of rows) {
    const id = typeof (row as { model_id?: unknown })?.model_id === 'string'
      ? (row as { model_id: string }).model_id
      : '';
    if (!id || seen.has(id)) continue;
    if (
      options?.chatOnly &&
      aihubmixRowTypes(row).some((type) => AIHUBMIX_MEDIA_GENERATION_TYPES.has(type))
    ) {
      continue;
    }
    seen.add(id);
    const name = typeof (row as { model_name?: unknown })?.model_name === 'string'
      ? (row as { model_name: string }).model_name
      : '';
    out.push({ id, label: name || id });
  }
  return out;
}
