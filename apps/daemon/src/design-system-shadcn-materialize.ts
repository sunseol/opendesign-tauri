import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { LocalDesignSystemImportError } from './design-system-import.js';
import { fetchText } from './design-system-shadcn-http.js';
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  SHADCN_FILES_SUBDIR,
  type ResolvedShadcnItem,
  type ShadcnCssVars,
  type ShadcnFetch,
  type ShadcnRegistryFile,
  type ShadcnRegistryItem,
} from './design-system-shadcn-types.js';

export async function materializeShadcnItem(
  item: ShadcnRegistryItem,
  tempDir: string,
  resolved: ResolvedShadcnItem,
  fetchImpl: ShadcnFetch,
): Promise<void> {
  await writeFile(path.join(tempDir, 'theme.css'), renderShadcnSourceCss(item.cssVars), 'utf8');
  const description =
    typeof item.description === 'string' && item.description.trim()
      ? item.description.trim()
      : `Imported from the shadcn registry item "${item.name ?? 'unknown'}".`;
  await writeFile(
    path.join(tempDir, 'package.json'),
    `${JSON.stringify({ description }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(tempDir, 'README.md'), renderShadcnReadme(item, resolved), 'utf8');
  await writeShadcnFiles(item, tempDir, resolved, fetchImpl);
}

export function renderShadcnSourceCss(cssVars: ShadcnCssVars | undefined): string {
  const rootLines: string[] = [];
  if (cssVars?.theme) {
    for (const [key, value] of Object.entries(cssVars.theme)) rootLines.push(declaration(key, value));
  }
  if (cssVars?.light) {
    for (const [key, value] of Object.entries(cssVars.light)) rootLines.push(declaration(key, value));
  }
  const darkLines = cssVars?.dark
    ? Object.entries(cssVars.dark).map(([key, value]) => declaration(key, value))
    : [];

  let css = `:root {\n${rootLines.join('\n')}\n}\n`;
  if (darkLines.length > 0) {
    css += `\n.dark {\n${darkLines.join('\n')}\n}\n`;
  }
  return css;
}

export function wrapShadcnColorValue(value: string): string {
  const trimmed = value.trim();
  if (/^(#|rgb|hsl|hwb|oklch|oklab|lab|lch|color|var|color-mix|calc)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(trimmed)) {
    return `hsl(${trimmed})`;
  }
  return trimmed;
}

export function cleanShadcnName(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'shadcn design system';
}

function declaration(key: string, value: unknown): string {
  const name = normalizeVarName(key);
  if (!/^--[A-Za-z0-9_-]+$/.test(name)) {
    throw new LocalDesignSystemImportError(
      'BAD_REQUEST',
      `shadcn cssVars key "${key}" is not a valid CSS custom property name`,
    );
  }
  const raw = String(value);
  if (/[;{}]/.test(raw) || /[\r\n]/.test(raw)) {
    throw new LocalDesignSystemImportError(
      'BAD_REQUEST',
      `shadcn cssVars value for "${key}" contains unsafe characters`,
    );
  }
  return `  ${name}: ${wrapShadcnColorValue(raw)};`;
}

function normalizeVarName(key: string): string {
  return `--${key.trim().replace(/^--/, '')}`;
}

function renderShadcnReadme(item: ShadcnRegistryItem, resolved: ResolvedShadcnItem): string {
  const dependencies = stringArray(item.dependencies);
  const registryDependencies = stringArray(item.registryDependencies);
  return [
    `# ${item.title ?? item.name ?? 'shadcn design system'}`,
    '',
    item.description ?? 'Imported from a shadcn registry item.',
    '',
    '## Source',
    '',
    `- Registry document: ${resolved.registryUrl}`,
    item.name ? `- Item: \`${item.name}\`${item.type ? ` (${item.type})` : ''}` : `- Item type: ${item.type ?? 'unknown'}`,
    resolved.homepage ? `- Registry homepage: ${resolved.homepage}` : '- Registry homepage: not declared',
    dependencies.length > 0 ? `- npm dependencies: ${dependencies.join(', ')}` : '- npm dependencies: none declared',
    registryDependencies.length > 0
      ? `- Registry dependencies: ${registryDependencies.join(', ')}`
      : '- Registry dependencies: none declared',
    '',
  ].join('\n');
}

async function writeShadcnFiles(
  item: ShadcnRegistryItem,
  tempDir: string,
  resolved: ResolvedShadcnItem,
  fetchImpl: ShadcnFetch,
): Promise<void> {
  const files = Array.isArray(item.files) ? item.files : [];
  if (files.length > MAX_FILES) {
    throw new LocalDesignSystemImportError(
      'BAD_REQUEST',
      `shadcn registry item declares ${files.length} files, exceeding the ${MAX_FILES}-file limit`,
    );
  }
  const used = new Map<string, string>();
  for (const file of files) {
    const declared = declaredShadcnFilePath(file);
    const relPath = sanitizeShadcnFilePath(file?.target ?? file?.path);
    if (!relPath) throw malformedShadcnFilePath(declared);
    const priorSource = used.get(relPath);
    if (priorSource !== undefined) {
      throw new LocalDesignSystemImportError(
        'BAD_REQUEST',
        `shadcn registry files "${priorSource}" and "${declared ?? relPath}" both resolve to "${relPath}"`,
      );
    }
    used.set(relPath, declared ?? relPath);
    const content = await resolveShadcnFileContent(file, declared, relPath, resolved, fetchImpl);
    const absPath = path.join(tempDir, SHADCN_FILES_SUBDIR, relPath);
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, content, 'utf8');
  }
}

async function resolveShadcnFileContent(
  file: ShadcnRegistryFile,
  declared: string | undefined,
  relPath: string,
  resolved: ResolvedShadcnItem,
  fetchImpl: ShadcnFetch,
): Promise<string> {
  let content = typeof file?.content === 'string' ? file.content : undefined;
  if (content === undefined) {
    if (resolved.rawBaseUrl && typeof file?.path === 'string' && file.path.trim()) {
      content = await fetchRawFileContent(resolved.rawBaseUrl, file.path, fetchImpl);
    } else {
      throw new LocalDesignSystemImportError(
        'BAD_REQUEST',
        `shadcn registry file "${declared ?? relPath}" has no inline content and cannot be fetched`,
      );
    }
  }
  if (content.length > MAX_FILE_BYTES) {
    throw new LocalDesignSystemImportError(
      'BAD_REQUEST',
      `shadcn registry file "${declared ?? relPath}" exceeds the ${MAX_FILE_BYTES}-byte limit`,
    );
  }
  return content;
}

async function fetchRawFileContent(
  rawBaseUrl: string,
  filePath: string,
  fetchImpl: ShadcnFetch,
): Promise<string> {
  const safe = filePath
    .split(/[\\/]/)
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  if (!safe) {
    throw new LocalDesignSystemImportError('BAD_REQUEST', `shadcn registry file "${filePath}" has no valid path`);
  }
  return await fetchText(`${rawBaseUrl}/${safe}`, fetchImpl);
}

function declaredShadcnFilePath(file: ShadcnRegistryFile): string | undefined {
  if (typeof file?.path === 'string' && file.path.trim()) return file.path.trim();
  if (typeof file?.target === 'string' && file.target.trim()) return file.target.trim();
  return undefined;
}

function malformedShadcnFilePath(declared: string | undefined): LocalDesignSystemImportError {
  return new LocalDesignSystemImportError(
    'BAD_REQUEST',
    declared
      ? `shadcn registry file "${declared}" has no safe destination path`
      : 'shadcn registry declares a file object with no path or target',
  );
}

function sanitizeShadcnFilePath(input: string | undefined): string | undefined {
  if (typeof input !== 'string') return undefined;
  let value = input.trim();
  if (!value) return undefined;
  value = value.replace(/^[~@][^/]*\//, '');
  value = value.replace(/^\/+/, '');
  value = value.replace(/^[A-Za-z]:[\\/]/, '');
  const segments = value.split(/[\\/]/).filter((segment) => segment && segment !== '.' && segment !== '..');
  if (segments.length === 0) return undefined;
  return segments.join('/');
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}
