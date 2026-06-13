// Baked plugin preview clips - daemon-side support for
// scripts/bake-plugin-previews.mjs.
//
// CI can pre-render expensive HTML plugin previews into small video clips plus
// poster images. The daemon keeps the original od.preview block intact and
// attaches the baked clip under od.bakedPreview so card surfaces can opt in
// while detail surfaces keep the interactive preview fallback.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const PLUGIN_PREVIEWS_ROUTE = '/api/plugin-previews';

const DEFAULT_PUBLIC_BASE = 'https://repo-assets.open-design.ai/plugin-previews';

interface BakeEntry {
  video: string;
  poster: string;
  holdMs?: number;
  durationMs?: number;
}

export interface BakedPreviewBlock {
  poster: string;
  video: string;
  holdMs?: number;
}

export function resolvePluginPreviewsDir(projectRoot: string): string {
  const env = process.env.OD_PLUGIN_PREVIEWS_DIR;
  if (env) return path.isAbsolute(env) ? env : path.resolve(projectRoot, env);
  return path.join(projectRoot, 'data', 'plugin-previews');
}

let cache: { dir: string; mtimeMs: number; previews: Record<string, BakeEntry> } | null = null;

function loadManifest(dir: string): Record<string, BakeEntry> {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return {};
  try {
    const mtimeMs = statSync(manifestPath).mtimeMs;
    if (cache && cache.dir === dir && cache.mtimeMs === mtimeMs) return cache.previews;
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      previews?: Record<string, BakeEntry>;
    };
    const previews = parsed.previews ?? {};
    cache = { dir, mtimeMs, previews };
    return previews;
  } catch (err) {
    console.warn(`[plugin-preview-bakes] failed to load ${manifestPath}: ${String(err)}`);
    return {};
  }
}

export function bakedPreviewBlock(id: string, dir: string): BakedPreviewBlock | null {
  const entry = loadManifest(dir)[id];
  if (!entry || !entry.video || !entry.poster) return null;

  const envBase = process.env.OD_PLUGIN_PREVIEWS_BASE_URL?.replace(/\/+$/, '');
  const onDisk =
    existsSync(path.join(dir, entry.video)) && existsSync(path.join(dir, entry.poster));
  const base = envBase || (onDisk ? PLUGIN_PREVIEWS_ROUTE : DEFAULT_PUBLIC_BASE);

  return {
    poster: `${base}/${entry.poster}`,
    video: `${base}/${entry.video}`,
    ...(typeof entry.holdMs === 'number' ? { holdMs: entry.holdMs } : {}),
  };
}

export function applyBakedPreviews<T extends { id: string; manifest?: unknown }>(
  records: T[],
  dir: string,
): T[] {
  return records.map((record) => {
    const block = bakedPreviewBlock(record.id, dir);
    if (!block) return record;

    const manifest = { ...((record.manifest ?? {}) as Record<string, unknown>) };
    const od = { ...((manifest.od ?? {}) as Record<string, unknown>) };
    od.bakedPreview = block;
    manifest.od = od;
    return { ...record, manifest };
  });
}
