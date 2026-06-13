import { useEffect, useMemo, useState } from 'react';

import type { MediaModel } from './models';
import { AUDIO_MODELS_BY_KIND, IMAGE_MODELS, VIDEO_MODELS } from './models';

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

const cachedModels = new Map<AIHubMixCatalogType, MediaModel[]>();
const inFlight = new Map<AIHubMixCatalogType, Promise<MediaModel[]>>();

function loadOnce(type: AIHubMixCatalogType): Promise<MediaModel[]> {
  const cached = cachedModels.get(type);
  if (cached && cached.length > 0) return Promise.resolve(cached);
  const existing = inFlight.get(type);
  if (existing) return existing;
  const pending = fetchAIHubMixModels(type)
    .then((models) => {
      cachedModels.set(type, models);
      return models;
    })
    .catch((error: unknown) => {
      inFlight.delete(type);
      if (error instanceof Error) return [];
      throw error;
    });
  inFlight.set(type, pending);
  return pending;
}

export function useAIHubMixModels(
  type: AIHubMixCatalogType,
  enabled = true,
): MediaModel[] {
  const [models, setModels] = useState<MediaModel[]>(() => cachedModels.get(type) ?? []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadOnce(type).then((fetched) => {
      if (active) setModels(fetched);
    });
    return () => {
      active = false;
    };
  }, [type, enabled]);

  return models;
}

export function useAIHubMixImageModels(enabled = true): MediaModel[] {
  return useAIHubMixModels('image_generation', enabled);
}

export function useAIHubMixVideoModels(enabled = true): MediaModel[] {
  return useAIHubMixModels('video', enabled);
}

export function useAIHubMixAudioModels(enabled = true): MediaModel[] {
  return useAIHubMixModels('tts', enabled);
}

export function useByokImageModelOptions(provider: string | undefined): MediaModel[] {
  const dynamic = useAIHubMixImageModels(provider === 'aihubmix');
  return useMemo(() => {
    if (provider === 'aihubmix') {
      return mergeAihubmixModels(IMAGE_MODELS, dynamic).filter(
        (model) => model.provider === 'aihubmix',
      );
    }
    return IMAGE_MODELS.filter((model) => model.provider === provider);
  }, [provider, dynamic]);
}

export function useByokVideoModelOptions(provider: string | undefined): MediaModel[] {
  const dynamic = useAIHubMixVideoModels(provider === 'aihubmix');
  return useMemo(() => {
    if (provider === 'aihubmix') {
      return mergeAihubmixModels(VIDEO_MODELS, dynamic).filter(
        (model) => model.provider === 'aihubmix',
      );
    }
    return VIDEO_MODELS.filter((model) => model.provider === provider);
  }, [provider, dynamic]);
}

export function useByokSpeechModelOptions(provider: string | undefined): MediaModel[] {
  const dynamic = useAIHubMixAudioModels(provider === 'aihubmix');
  const speechSeeds = useMemo(() => AUDIO_MODELS_BY_KIND.speech, []);
  return useMemo(() => {
    if (provider === 'aihubmix') {
      return mergeAihubmixModels(speechSeeds, dynamic).filter(
        (model) => model.provider === 'aihubmix',
      );
    }
    return speechSeeds.filter((model) => model.provider === provider);
  }, [provider, dynamic, speechSeeds]);
}
