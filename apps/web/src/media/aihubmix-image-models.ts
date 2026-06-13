import type { MediaModel } from './models';

export type AIHubMixCatalogType = 'image_generation' | 'video' | 'tts';

type FetchedModel = {
  readonly id: string;
  readonly label: string;
};

class AIHubMixCatalogFetchError extends Error {
  readonly name = 'AIHubMixCatalogFetchError';

  constructor(
    readonly catalogType: AIHubMixCatalogType,
    readonly status: number,
  ) {
    super(`AIHubMix ${catalogType} catalog request failed with ${status}`);
  }
}

const CAPS_BY_TYPE = {
  image_generation: ['t2i', 'i2i'],
  video: ['t2v', 'i2v'],
  tts: ['tts'],
} as const satisfies Record<AIHubMixCatalogType, readonly string[]>;

function toMediaModel(model: FetchedModel, type: AIHubMixCatalogType): MediaModel {
  return {
    id: model.id,
    label: model.label,
    hint: 'AIHubMix',
    provider: 'aihubmix',
    caps: [...CAPS_BY_TYPE[type]],
  };
}

function isFetchedModel(value: unknown): value is FetchedModel {
  if (!value || typeof value !== 'object') return false;
  if (!('id' in value) || !('label' in value)) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.label === 'string';
}

function readModelRows(payload: unknown): readonly unknown[] {
  if (!payload || typeof payload !== 'object' || !('models' in payload)) return [];
  return Array.isArray(payload.models) ? payload.models : [];
}

export async function fetchAIHubMixModels(
  type: AIHubMixCatalogType,
  signal?: AbortSignal,
): Promise<MediaModel[]> {
  const response = await fetch(
    `/api/media/providers/aihubmix/models?type=${type}`,
    { signal },
  );
  if (!response.ok) throw new AIHubMixCatalogFetchError(type, response.status);
  const payload: unknown = await response.json();
  const rows = readModelRows(payload);
  return rows.filter(isFetchedModel).map((model) => toMediaModel(model, type));
}

export function fetchAIHubMixImageModels(signal?: AbortSignal): Promise<MediaModel[]> {
  return fetchAIHubMixModels('image_generation', signal);
}

export function mergeAihubmixModels(
  base: readonly MediaModel[],
  dynamic: readonly MediaModel[],
): MediaModel[] {
  if (dynamic.length === 0) return [...base];
  const withoutSeeds = base.filter((model) => model.provider !== 'aihubmix');
  return [...withoutSeeds, ...dynamic];
}

export const mergeAihubmixImageModels = mergeAihubmixModels;
