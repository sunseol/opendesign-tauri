export const RELEASE_METADATA_URL = '/release-metadata';
export const RELEASE_REPOSITORY = 'sunseol/opendesign-tauri';
export const RELEASE_REPOSITORY_URL = `https://github.com/${RELEASE_REPOSITORY}`;
export const RELEASE_GITHUB_API = `https://api.github.com/repos/${RELEASE_REPOSITORY}`;
export const RELEASE_GITHUB_LATEST_URL = `${RELEASE_GITHUB_API}/releases/latest`;
export const RELEASE_GITHUB_RELEASES_URL = `${RELEASE_REPOSITORY_URL}/releases`;
export const FALLBACK_RELEASE_VERSION = '0.0.0-tauri';
export const FALLBACK_RELEASE_VERSION_LABEL = 'Tauri builds pending';

export interface ReleaseMetadataFallback {
  readonly baseVersion: string;
  readonly displayVersion: string;
  readonly releaseUrl: string;
  readonly resolved: false;
  readonly channel: 'tauri-fork';
}

export function fallbackReleaseMetadata(): ReleaseMetadataFallback {
  return {
    baseVersion: FALLBACK_RELEASE_VERSION,
    displayVersion: FALLBACK_RELEASE_VERSION_LABEL,
    releaseUrl: RELEASE_GITHUB_RELEASES_URL,
    resolved: false,
    channel: 'tauri-fork',
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function stringField(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function formatStableReleaseVersion(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  const displayVersion = stringField(metadata, 'displayVersion');
  if (displayVersion) return displayVersion;

  const fromVersion = (version: unknown) => {
    if (typeof version !== 'string') return null;
    const match = version.match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
    return match ? `v${match[1]}` : null;
  };

  const fromTag = (tag: unknown) => {
    if (typeof tag !== 'string') return null;
    const cleaned = tag.replace(/^open-design[-_]?v?/i, '').trim();
    return cleaned ? `v${cleaned.replace(/^v/, '')}` : null;
  };

  return (
    fromVersion(stringField(metadata, 'releaseVersion')) ??
    fromVersion(stringField(metadata, 'stableVersion')) ??
    fromVersion(stringField(metadata, 'baseVersion')) ??
    fromVersion(stringField(metadata, 'name')) ??
    fromTag(stringField(metadata, 'versionTag')) ??
    fromTag(stringField(metadata, 'tag_name'))
  );
}
