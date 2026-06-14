import {
  FALLBACK_RELEASE_VERSION,
  FALLBACK_RELEASE_VERSION_LABEL,
  RELEASE_GITHUB_LATEST_URL,
  RELEASE_GITHUB_RELEASES_URL,
  formatStableReleaseVersion,
} from './release-metadata';

export interface GithubRepoMeta {
  readonly starsLabel: string;
  readonly versionLabel: string;
}

const SOURCE_REPO_API = 'https://api.github.com/repos/nexu-io/open-design';
const FALLBACK_META: GithubRepoMeta = {
  starsLabel: '40K+',
  versionLabel: FALLBACK_RELEASE_VERSION_LABEL,
};

let repoMetaPromise: Promise<GithubRepoMeta> | null = null;

class FetchJsonError extends Error {
  readonly name = 'FetchJsonError';

  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`Request returned ${status}: ${url}`);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function stringField(record: Readonly<Record<string, unknown>> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function numberField(record: Readonly<Record<string, unknown>> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'number' ? value : null;
}

function formatStars(count: unknown): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
}

function formatVersion(release: unknown): string | null {
  if (!isRecord(release)) return null;
  const fromName = (name: unknown) => {
    if (typeof name !== 'string') return null;
    const match = name.match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
    return match ? `v${match[1]}` : null;
  };
  const fromTag = (tag: unknown) => {
    if (typeof tag !== 'string') return null;
    const cleaned = tag.replace(/^open-design[-_]?v?/i, '').trim();
    return cleaned ? `v${cleaned.replace(/^v/, '')}` : null;
  };
  return fromName(stringField(release, 'name')) ?? fromTag(stringField(release, 'tag_name'));
}

async function fetchJson(url: string, headers?: Readonly<Record<string, string>>): Promise<unknown> {
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) throw new FetchJsonError(response.status, url);
  return response.json();
}

export function getGithubRepoMeta(): Promise<GithubRepoMeta> {
  repoMetaPromise ??= (async () => {
    const [repoResult, releaseMetadataResult] = await Promise.allSettled([
      fetchJson(SOURCE_REPO_API, { Accept: 'application/vnd.github+json' }),
      fetchJson(RELEASE_GITHUB_LATEST_URL, { Accept: 'application/vnd.github+json' }),
    ]);

    const repo = repoResult.status === 'fulfilled' && isRecord(repoResult.value) ? repoResult.value : null;
    const releaseMetadata = releaseMetadataResult.status === 'fulfilled' ? releaseMetadataResult.value : null;
    const starsLabel = formatStars(numberField(repo, 'stargazers_count'));
    const versionLabel = formatStableReleaseVersion(releaseMetadata);

    return {
      starsLabel: starsLabel ?? FALLBACK_META.starsLabel,
      versionLabel: versionLabel ?? FALLBACK_META.versionLabel,
    };
  })();

  return repoMetaPromise;
}

export interface ReleaseAsset {
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly sha256Url: string | null;
}

export interface ReleaseMatrix {
  readonly macArm64Dmg: ReleaseAsset | null;
  readonly macArm64Zip: ReleaseAsset | null;
  readonly macX64Dmg: ReleaseAsset | null;
  readonly macX64Zip: ReleaseAsset | null;
  readonly winSetup: ReleaseAsset | null;
  readonly winPortable: ReleaseAsset | null;
  readonly linux: ReleaseAsset | null;
}

export interface LatestRelease {
  readonly version: string;
  readonly versionLabel: string;
  readonly tagName: string | null;
  readonly publishedAt: string | null;
  readonly releaseUrl: string;
  readonly matrix: ReleaseMatrix;
  readonly resolved: boolean;
}

interface RawAsset {
  readonly name: string;
  readonly browser_download_url: string;
  readonly size?: unknown;
}

const EMPTY_MATRIX: ReleaseMatrix = {
  macArm64Dmg: null,
  macArm64Zip: null,
  macX64Dmg: null,
  macX64Zip: null,
  winSetup: null,
  winPortable: null,
  linux: null,
};

function cleanVersion(versionLabel: string): string {
  return versionLabel.replace(/^v/, '');
}

function isRawAsset(value: unknown): value is RawAsset {
  return isRecord(value) && typeof value.name === 'string' && typeof value.browser_download_url === 'string';
}

function buildMatrix(rawAssets: readonly unknown[]): ReleaseMatrix {
  const assets = rawAssets.filter(isRawAsset);

  const sha256For = (name: string): string | null => {
    const sib = assets.find((a) => a.name === `${name}.sha256`);
    return sib ? sib.browser_download_url : null;
  };

  const pick = (match: (name: string) => boolean): ReleaseAsset | null => {
    const asset = assets.find((candidate) => !candidate.name.endsWith('.sha256') && match(candidate.name));
    if (!asset) return null;
    return {
      name: asset.name,
      url: asset.browser_download_url,
      size: typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : 0,
      sha256Url: sha256For(asset.name),
    };
  };

  return {
    macArm64Dmg: pick((name) => name.endsWith('mac-arm64.dmg')),
    macArm64Zip: pick((name) => name.endsWith('mac-arm64.zip')),
    macX64Dmg: pick((name) => name.endsWith('mac-x64.dmg')),
    macX64Zip: pick((name) => name.endsWith('mac-x64.zip')),
    winSetup: pick((name) => /win.*setup\.exe$/.test(name)),
    winPortable: pick((name) => /win.*portable\.zip$/.test(name)),
    linux: pick((name) => /\.appimage$/i.test(name)),
  };
}

let latestReleasePromise: Promise<LatestRelease> | null = null;

function fallbackLatestRelease(): LatestRelease {
  return {
    version: FALLBACK_RELEASE_VERSION,
    versionLabel: FALLBACK_RELEASE_VERSION_LABEL,
    tagName: null,
    publishedAt: null,
    releaseUrl: RELEASE_GITHUB_RELEASES_URL,
    matrix: EMPTY_MATRIX,
    resolved: false,
  };
}

export function getLatestRelease(): Promise<LatestRelease> {
  latestReleasePromise ??= (async () => {
    try {
      const release = await fetchJson(RELEASE_GITHUB_LATEST_URL, { Accept: 'application/vnd.github+json' });
      const rec = isRecord(release) ? release : null;
      if (!rec) return fallbackLatestRelease();

      const versionLabel = formatVersion(release) ?? FALLBACK_META.versionLabel;
      const rawAssetsValue = rec.assets;
      const rawAssets: readonly unknown[] = Array.isArray(rawAssetsValue) ? rawAssetsValue : [];
      const matrix = buildMatrix(rawAssets);
      const resolved = Object.values(matrix).some((asset) => asset !== null);

      return {
        version: cleanVersion(versionLabel),
        versionLabel,
        tagName: stringField(rec, 'tag_name'),
        publishedAt: stringField(rec, 'published_at'),
        releaseUrl: stringField(rec, 'html_url') ?? RELEASE_GITHUB_RELEASES_URL,
        matrix,
        resolved,
      };
    } catch (error) {
      if (error instanceof Error) return fallbackLatestRelease();
      throw error;
    }
  })();

  return latestReleasePromise;
}
