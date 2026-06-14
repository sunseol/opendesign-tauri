export function projectRelativePathFromBrowserUrl(
  url: string,
  resolvedDir?: string | null,
): string | null {
  const root = normalizeLocalFsPath(resolvedDir);
  if (!root) return null;
  const filePath = filePathFromFileUrl(url);
  if (!filePath || filePath === root || !filePath.startsWith(`${root}/`)) return null;
  const relativePath = filePath.slice(root.length + 1).replace(/^\/+/u, '');
  if (!relativePath || relativePath.includes('\0')) return null;
  return relativePath;
}

export function browserCommentFilePath(url: string, resolvedDir?: string | null): string {
  const projectPath = projectRelativePathFromBrowserUrl(url, resolvedDir);
  if (projectPath) return projectPath;
  const cleanUrl = url.trim();
  return cleanUrl && cleanUrl !== 'about:blank' ? `browser:${cleanUrl}` : 'browser:about:blank';
}

export function isProjectHtmlBrowserUrl(url: string, resolvedDir?: string | null): boolean {
  const projectPath = projectRelativePathFromBrowserUrl(url, resolvedDir);
  return Boolean(projectPath && /\.html?$/i.test(projectPath));
}

function normalizeLocalFsPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\\/gu, '/').replace(/\/+$/u, '');
  return normalized || null;
}

function filePathFromFileUrl(url: string): string | null {
  const cleanUrl = url.trim();
  if (!/^file:\/\//i.test(cleanUrl)) return null;
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'file:') return null;
    return normalizeLocalFsPath(decodeURIComponent(parsed.pathname));
  } catch (error) {
    if (error instanceof TypeError || error instanceof URIError) return null;
    throw error;
  }
}
