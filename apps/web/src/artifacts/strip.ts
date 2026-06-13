import { computeSkipRanges, isRealArtifactOpenAt, rangeContains, type Range } from './markdown-context';

const OPEN = '<artifact';
const CLOSE = '</artifact>';

function findUnskipped(content: string, needle: string, fromIndex: number, ranges: ReadonlyArray<Range>): number {
  let from = fromIndex;
  while (from <= content.length) {
    const idx = content.indexOf(needle, from);
    if (idx === -1) return -1;
    if (!rangeContains(ranges, idx)) return idx;
    from = idx + needle.length;
  }
  return -1;
}

// Like `findUnskipped(OPEN, …)` but also rejects prefix-shared literals like
// `<artifactual` — only `<artifact` followed by whitespace counts as a real
// protocol open. Matches the parser's `findOpenTag` real-open guard so the
// two paths agree on what the renderer will treat as a tag.
function findRealOpen(content: string, fromIndex: number, ranges: ReadonlyArray<Range>): number {
  let from = fromIndex;
  while (from <= content.length) {
    const idx = content.indexOf(OPEN, from);
    if (idx === -1) return -1;
    if (rangeContains(ranges, idx) || !isRealArtifactOpenAt(content, idx)) {
      from = idx + OPEN.length;
      continue;
    }
    return idx;
  }
  return -1;
}

/**
 * Remove the first real `<artifact …>…</artifact>` block from `content`.
 *
 * "Real" excludes any `<artifact` substring that the chat Markdown renderer
 * would render as inline code or part of a fenced code block — those are
 * literal recitations of the protocol and must survive intact, otherwise
 * the rendered chat reply gets silently truncated mid-explanation.
 *
 * If no real open tag exists, the content is returned unchanged. If a real
 * open exists but no matching real close is found, the content is also
 * returned unchanged (refusing to strip is safer than truncating to
 * end-of-string when a tag is malformed or still streaming).
 */
export function stripArtifact(content: string): string {
  const { ranges: baseRanges, unclosedFenceStart } = computeSkipRanges(content);
  // For complete (non-streaming) content, an unclosed fence is rendered by
  // the chat Markdown renderer as a code block extending to end of input
  // (see runtime/markdown.tsx:49 — the close-loop runs until lines exhaust).
  // The stripper has to mirror that, otherwise a literal `<artifact …>`
  // tucked into a code example at the bottom of a chat reply (no trailing
  // newline) gets treated as a real protocol tag and eaten.
  const ranges: Range[] =
    unclosedFenceStart !== null ? [...baseRanges, [unclosedFenceStart, content.length]] : baseRanges;
  const open = findRealOpen(content, 0, ranges);
  if (open === -1) return content;
  const closeTag = content.indexOf('>', open);
  if (closeTag === -1) return content;
  const end = findUnskipped(content, CLOSE, closeTag, ranges);
  if (end === -1) return content;
  return (content.slice(0, open) + content.slice(end + CLOSE.length)).trim();
}

export interface PersistedArtifactFileRef {
  name: string;
  identifier?: string;
}

function parseArtifactAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([^\s=<>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null = attrPattern.exec(raw);
  while (match !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (key) attrs[key] = value;
    match = attrPattern.exec(raw);
  }
  return attrs;
}

function artifactExtensionForAttrs(attrs: Record<string, string>): '.html' | '.jsx' | '.tsx' {
  const type = (attrs.type ?? '').toLowerCase();
  const identifier = (attrs.identifier ?? '').toLowerCase();
  if (type.includes('tsx') || identifier.endsWith('.tsx')) return '.tsx';
  if (type.includes('jsx') || type.includes('react') || identifier.endsWith('.jsx')) return '.jsx';
  return '.html';
}

function artifactBaseNameForAttrs(attrs: Record<string, string>): string {
  return (
    (attrs.identifier ?? attrs.title ?? 'artifact')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'artifact'
  );
}

function matchesPersistedArtifactName(name: string, base: string, ext: string): boolean {
  if (name === `${base}${ext}`) return true;
  if (!name.startsWith(`${base}-`) || !name.endsWith(ext)) return false;
  return /^\d+$/.test(name.slice(base.length + 1, name.length - ext.length));
}

export function matchPersistedArtifactFile(
  attrs: Record<string, string>,
  persistedFiles: ReadonlyArray<PersistedArtifactFileRef>,
): PersistedArtifactFileRef | null {
  const identifier = attrs.identifier ?? '';
  if (identifier) {
    const byIdentifier = persistedFiles.find((file) => file.identifier === identifier);
    if (byIdentifier) return byIdentifier;
  }
  const ext = artifactExtensionForAttrs(attrs);
  const base = artifactBaseNameForAttrs(attrs);
  return persistedFiles.find((file) => matchesPersistedArtifactName(file.name, base, ext)) ?? null;
}

function artifactTranscriptSummary(
  attrs: Record<string, string>,
  persisted: PersistedArtifactFileRef,
): string {
  const metadata = [
    attrs.identifier ? `identifier="${attrs.identifier}"` : '',
    attrs.title ? `title="${attrs.title}"` : '',
    `type="${attrs.type ?? 'text/html'}"`,
  ].filter(Boolean).join(', ');
  return `[artifact emitted on a prior turn — ${metadata}. Its full content was saved to the project file "${persisted.name}" and is not repeated here. Read or modify that file on disk.]`;
}

export function summarizeArtifactsForTranscript(
  content: string,
  persistedFiles: ReadonlyArray<PersistedArtifactFileRef>,
): string {
  if (persistedFiles.length === 0) return content;
  let result = '';
  let cursor = 0;
  while (cursor <= content.length) {
    const tail = content.slice(cursor);
    const { ranges: baseRanges, unclosedFenceStart } = computeSkipRanges(tail);
    const ranges: Range[] =
      unclosedFenceStart !== null ? [...baseRanges, [unclosedFenceStart, tail.length]] : baseRanges;
    const open = findRealOpen(tail, 0, ranges);
    if (open === -1) {
      result += tail;
      break;
    }
    const closeTag = tail.indexOf('>', open);
    if (closeTag === -1) {
      result += tail;
      break;
    }
    const end = findUnskipped(tail, CLOSE, closeTag, ranges);
    if (end === -1) {
      result += tail;
      break;
    }
    const attrs = parseArtifactAttrs(tail.slice(open, closeTag));
    const persisted = matchPersistedArtifactFile(attrs, persistedFiles);
    result += persisted
      ? tail.slice(0, open) + artifactTranscriptSummary(attrs, persisted)
      : tail.slice(0, end + CLOSE.length);
    cursor += end + CLOSE.length;
  }
  return result;
}
