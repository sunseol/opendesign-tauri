import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PLUGIN_PREVIEWS_ROUTE,
  applyBakedPreviews,
} from '../src/plugin-preview-bakes.js';

type TestRecord = {
  id: string;
  manifest: { od: Record<string, unknown> };
};

const tempDirs: string[] = [];
const originalBaseUrl = process.env.OD_PLUGIN_PREVIEWS_BASE_URL;

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'od-plugin-preview-bakes-'));
  tempDirs.push(dir);
  return dir;
}

async function writeManifest(dir: string, id = 'demo-plugin'): Promise<void> {
  await writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      previews: {
        [id]: {
          video: `${id}.abcd.mp4`,
          poster: `${id}.abcd.poster.jpg`,
          holdMs: 2500,
        },
      },
    }),
  );
}

afterEach(async () => {
  if (originalBaseUrl == null) {
    delete process.env.OD_PLUGIN_PREVIEWS_BASE_URL;
  } else {
    process.env.OD_PLUGIN_PREVIEWS_BASE_URL = originalBaseUrl;
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('applyBakedPreviews', () => {
  it('attaches public baked preview metadata without replacing od.preview', async () => {
    const dir = await makeDir();
    await writeManifest(dir);
    const [record] = applyBakedPreviews<TestRecord>(
      [
        {
          id: 'demo-plugin',
          manifest: {
            od: {
              preview: { type: 'html', entry: './example.html' },
            },
          },
        },
      ],
      dir,
    );
    expect(record).toBeDefined();

    expect(record!.manifest.od.preview).toEqual({ type: 'html', entry: './example.html' });
    expect(record!.manifest.od.bakedPreview).toEqual({
      poster: 'https://repo-assets.open-design.ai/plugin-previews/demo-plugin.abcd.poster.jpg',
      video: 'https://repo-assets.open-design.ai/plugin-previews/demo-plugin.abcd.mp4',
      holdMs: 2500,
    });
  });

  it('uses the daemon static route when baked files are present locally', async () => {
    const dir = await makeDir();
    await writeManifest(dir);
    await writeFile(path.join(dir, 'demo-plugin.abcd.mp4'), '');
    await writeFile(path.join(dir, 'demo-plugin.abcd.poster.jpg'), '');

    const [record] = applyBakedPreviews<TestRecord>(
      [{ id: 'demo-plugin', manifest: { od: {} } }],
      dir,
    );
    expect(record).toBeDefined();

    expect(record!.manifest.od.bakedPreview).toMatchObject({
      poster: `${PLUGIN_PREVIEWS_ROUTE}/demo-plugin.abcd.poster.jpg`,
      video: `${PLUGIN_PREVIEWS_ROUTE}/demo-plugin.abcd.mp4`,
    });
  });

  it('honors the public base url override', async () => {
    const dir = await makeDir();
    await writeManifest(dir);
    process.env.OD_PLUGIN_PREVIEWS_BASE_URL = 'https://cdn.example.com/previews/';

    const [record] = applyBakedPreviews<TestRecord>(
      [{ id: 'demo-plugin', manifest: { od: {} } }],
      dir,
    );
    expect(record).toBeDefined();

    expect(record!.manifest.od.bakedPreview).toMatchObject({
      poster: 'https://cdn.example.com/previews/demo-plugin.abcd.poster.jpg',
      video: 'https://cdn.example.com/previews/demo-plugin.abcd.mp4',
    });
  });

  it('leaves records unchanged when the manifest has no matching preview', async () => {
    const dir = await makeDir();
    await writeManifest(dir, 'other-plugin');
    const input: TestRecord = { id: 'demo-plugin', manifest: { od: {} } };

    const [record] = applyBakedPreviews([input], dir);

    expect(record).toBe(input);
  });
});
