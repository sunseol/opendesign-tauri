// Map React module files back to the HTML entries that load them.
//
// Multi-file React prototypes split components across `.jsx` / `.tsx` files
// that are loaded together by an HTML entry through Babel script tags. A
// module on its own has no standalone component to render, so the preview UI
// should point users at the HTML entry instead of showing a runtime error.

function basenameOf(path: string): string {
  return path.split('/').pop() ?? path;
}

function normalizeScriptRef(src: string): string {
  return (src.split(/[?#]/)[0] ?? '').replace(/^\.\//, '').trim();
}

export function extractBabelScriptSrcs(html: string | null | undefined): string[] {
  if (!html) return [];
  const scannable = html.replace(/<!--[\s\S]*?-->/g, '');
  const srcs: string[] = [];
  const scriptOpenTag = /<script\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptOpenTag.exec(scannable)) !== null) {
    const attrs = match[1] ?? '';
    if (!/\btype\s*=\s*["']?text\/babel\b/i.test(attrs)) continue;
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const ref = srcMatch?.[1] ? normalizeScriptRef(srcMatch[1]) : '';
    if (ref) srcs.push(ref);
  }
  return srcs;
}

export function htmlLoadsJsxModule(html: string | null | undefined, jsxName: string): boolean {
  if (!jsxName) return false;
  const target = normalizeScriptRef(jsxName);
  const targetBase = basenameOf(target);
  return extractBabelScriptSrcs(html).some((ref) => {
    if (ref === target) return true;
    return basenameOf(ref) === targetBase;
  });
}

export function findHtmlEntriesReferencing(
  jsxName: string,
  htmlSources: ReadonlyMap<string, string>,
): string[] {
  if (!jsxName) return [];
  const entries: string[] = [];
  for (const [htmlName, html] of htmlSources) {
    if (htmlLoadsJsxModule(html, jsxName)) entries.push(htmlName);
  }
  return entries;
}

export function isJsxModule(
  jsxName: string,
  htmlSources: ReadonlyMap<string, string>,
): boolean {
  return findHtmlEntriesReferencing(jsxName, htmlSources).length > 0;
}

function isHtmlName(name: string): boolean {
  return /\.html?$/i.test(name);
}

interface NamedFile {
  readonly name: string;
}

export async function collectReferencedJsxNames(
  files: ReadonlyArray<NamedFile>,
  readHtml: (name: string) => Promise<string | null>,
): Promise<Set<string>> {
  const referencedSrcs = new Set<string>();
  await Promise.all(
    files
      .filter((file) => isHtmlName(file.name))
      .map(async (file) => {
        const html = await readHtml(file.name);
        for (const src of extractBabelScriptSrcs(html)) referencedSrcs.add(src);
      }),
  );
  if (referencedSrcs.size === 0) return new Set();

  const result = new Set<string>();
  for (const file of files) {
    if (!/\.(jsx|tsx)$/i.test(file.name)) continue;
    const base = basenameOf(file.name);
    for (const src of referencedSrcs) {
      if (src === file.name || basenameOf(src) === base) {
        result.add(file.name);
        break;
      }
    }
  }
  return result;
}
