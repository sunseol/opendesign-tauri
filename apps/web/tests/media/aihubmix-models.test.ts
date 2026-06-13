// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import {
  fetchAIHubMixImageModels,
  fetchAIHubMixModels,
  mergeAihubmixImageModels,
  mergeAihubmixModels,
  useAIHubMixModels,
  useByokImageModelOptions,
} from '../../src/media/aihubmix-image-models';
import type { MediaModel } from '../../src/media/models';

describe('AIHubMix media catalog helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches image catalogue rows as AIHubMix media models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { id: 'aihubmix-qwen-image-2-pro', label: 'Qwen Image 2 Pro' },
          { id: '', label: 'Empty id' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAIHubMixModels('image_generation')).resolves.toEqual([
      {
        id: 'aihubmix-qwen-image-2-pro',
        label: 'Qwen Image 2 Pro',
        hint: 'AIHubMix',
        provider: 'aihubmix',
        caps: ['t2i', 'i2i'],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/providers/aihubmix/models?type=image_generation',
      { signal: undefined },
    );
  });

  it('maps video and speech catalogues to their surface capabilities', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ id: 'aihubmix-video', label: 'Video' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ id: 'aihubmix-tts', label: 'Speech' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAIHubMixModels('video')).resolves.toMatchObject([
      { id: 'aihubmix-video', provider: 'aihubmix', caps: ['t2v', 'i2v'] },
    ]);
    await expect(fetchAIHubMixModels('tts')).resolves.toMatchObject([
      { id: 'aihubmix-tts', provider: 'aihubmix', caps: ['tts'] },
    ]);
  });

  it('keeps static AIHubMix seeds until a live catalogue is available', () => {
    const base: readonly MediaModel[] = [
      mediaModel('gpt-image-2', 'openai'),
      mediaModel('aihubmix-gpt-image-1', 'aihubmix'),
    ];

    expect(mergeAihubmixModels(base, [])).toEqual(base);
  });

  it('replaces static AIHubMix seeds with live catalogue rows', () => {
    const base: readonly MediaModel[] = [
      mediaModel('gpt-image-2', 'openai'),
      mediaModel('aihubmix-gpt-image-1', 'aihubmix'),
    ];
    const dynamic = [mediaModel('aihubmix-qwen-image-2-pro', 'aihubmix')];

    expect(mergeAihubmixModels(base, dynamic)).toEqual([
      mediaModel('gpt-image-2', 'openai'),
      mediaModel('aihubmix-qwen-image-2-pro', 'aihubmix'),
    ]);
    expect(mergeAihubmixImageModels(base, dynamic)).toEqual(
      mergeAihubmixModels(base, dynamic),
    );
  });

  it('keeps the image-only fetch alias on the image catalogue', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAIHubMixImageModels()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/providers/aihubmix/models?type=image_generation',
      { signal: undefined },
    );
  });

  it('does not fetch live catalogues when the hook is disabled', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAIHubMixModels('image_generation', false));

    expect(result.current).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses static BYOK image seeds until the AIHubMix live catalogue loads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ id: 'aihubmix-qwen-image-2-pro', label: 'Qwen Image 2 Pro' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useByokImageModelOptions('aihubmix'));

    expect(result.current.map((model) => model.id)).toContain('aihubmix-gpt-image-1');
    await waitFor(() => {
      expect(result.current.map((model) => model.id)).toEqual([
        'aihubmix-qwen-image-2-pro',
      ]);
    });
  });

  it('uses static provider options without fetching for non-AIHubMix providers', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useByokImageModelOptions('openai'));

    expect(result.current.every((model) => model.provider === 'openai')).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function mediaModel(id: string, provider: MediaModel['provider']): MediaModel {
  return {
    id,
    label: id,
    hint: provider,
    provider,
    caps: ['t2i'],
  };
}
