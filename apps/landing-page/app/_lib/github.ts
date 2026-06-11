import { RELEASE_METADATA_UPSTREAM_URL, formatStableReleaseVersion } from './release-metadata';

export interface GithubRepoMeta {
  starsLabel: string;
  versionLabel: string;
}

const REPO_API = 'https://api.github.com/repos/nexu-io/open-design';
const FALLBACK_META: GithubRepoMeta = {
  starsLabel: '40K+',
  versionLabel: 'v0.9.0',
};

let repoMetaPromise: Promise<GithubRepoMeta> | null = null;

function formatStars(count: unknown): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) throw new Error(`Request returned ${response.status}: ${url}`);
  return response.json();
}

export function getGithubRepoMeta(): Promise<GithubRepoMeta> {
  repoMetaPromise ??= (async () => {
    const [repoResult, releaseMetadataResult] = await Promise.allSettled([
      fetchJson(REPO_API, { Accept: 'application/vnd.github+json' }),
      fetchJson(RELEASE_METADATA_UPSTREAM_URL, { Accept: 'application/json' }),
    ]);

    const repo = repoResult.status === 'fulfilled' ? repoResult.value : null;
    const releaseMetadata = releaseMetadataResult.status === 'fulfilled'
      ? releaseMetadataResult.value
      : null;
    const starsLabel = formatStars((repo as { stargazers_count?: unknown } | null)?.stargazers_count);
    const versionLabel = formatStableReleaseVersion(releaseMetadata);

    return {
      starsLabel: starsLabel ?? FALLBACK_META.starsLabel,
      versionLabel: versionLabel ?? FALLBACK_META.versionLabel,
    };
  })();

  return repoMetaPromise;
}

const REPO_RELEASES = 'https://github.com/nexu-io/open-design/releases';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  sha256Url: string | null;
}

export interface ReleaseMatrix {
  macArm64Dmg: ReleaseAsset | null;
  macArm64Zip: ReleaseAsset | null;
  macX64Dmg: ReleaseAsset | null;
  macX64Zip: ReleaseAsset | null;
  winSetup: ReleaseAsset | null;
  winPortable: ReleaseAsset | null;
  linux: ReleaseAsset | null;
}

export interface LatestRelease {
  version: string;
  versionLabel: string;
  tagName: string | null;
  publishedAt: string | null;
  releaseUrl: string;
  matrix: ReleaseMatrix;
  resolved: boolean;
}

interface RawAsset {
  name?: unknown;
  url?: unknown;
  size?: unknown;
  sha256Url?: unknown;
}

interface ReleaseMetadata {
  versionTag?: unknown;
  generatedAt?: unknown;
  publishedAt?: unknown;
  platforms?: {
    mac?: { artifacts?: Record<string, RawAsset | undefined> };
    macIntel?: { artifacts?: Record<string, RawAsset | undefined> };
    win?: { artifacts?: Record<string, RawAsset | undefined> };
    linux?: { artifacts?: Record<string, RawAsset | undefined> };
  };
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

function toReleaseUrl(versionLabel: string, tag: unknown): string {
  if (typeof tag === 'string' && tag.length > 0) {
    return `${REPO_RELEASES}/tag/${tag}`;
  }
  return `${REPO_RELEASES}/tag/open-design-${versionLabel}`;
}

function pickArtifact(asset: RawAsset | undefined): ReleaseAsset | null {
  if (!asset) return null;
  if (typeof asset.name !== 'string' || typeof asset.url !== 'string') return null;
  return {
    name: asset.name,
    url: asset.url,
    size: typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : 0,
    sha256Url: typeof asset.sha256Url === 'string' ? asset.sha256Url : null,
  };
}

function buildMatrixFromMetadata(metadata: ReleaseMetadata): ReleaseMatrix {
  const platforms = metadata.platforms ?? {};

  return {
    macArm64Dmg: pickArtifact(platforms.mac?.artifacts?.dmg),
    macArm64Zip: pickArtifact(platforms.mac?.artifacts?.zip),
    macX64Dmg: pickArtifact(platforms.macIntel?.artifacts?.dmg),
    macX64Zip: pickArtifact(platforms.macIntel?.artifacts?.zip),
    winSetup: pickArtifact(platforms.win?.artifacts?.installer),
    winPortable: pickArtifact(platforms.win?.artifacts?.portableZip),
    linux: pickArtifact(platforms.linux?.artifacts?.appImage),
  };
}

let latestReleasePromise: Promise<LatestRelease> | null = null;

export function getLatestRelease(): Promise<LatestRelease> {
  latestReleasePromise ??= (async () => {
    let metadata: unknown = null;
    try {
      metadata = await fetchJson(RELEASE_METADATA_UPSTREAM_URL, { Accept: 'application/json' });
    } catch {
      metadata = null;
    }

    const rec = (metadata && typeof metadata === 'object' ? metadata : {}) as ReleaseMetadata;
    const versionLabel = formatStableReleaseVersion(metadata) ?? FALLBACK_META.versionLabel;
    const matrix = metadata ? buildMatrixFromMetadata(rec) : EMPTY_MATRIX;
    const resolved = Boolean(metadata) && Object.values(matrix).some((asset) => asset !== null);

    return {
      version: cleanVersion(versionLabel),
      versionLabel,
      tagName: typeof rec.versionTag === 'string' ? rec.versionTag : null,
      publishedAt:
        typeof rec.publishedAt === 'string'
          ? rec.publishedAt
          : typeof rec.generatedAt === 'string'
            ? rec.generatedAt
            : null,
      releaseUrl: toReleaseUrl(versionLabel, rec.versionTag),
      matrix,
      resolved,
    };
  })();

  return latestReleasePromise;
}
