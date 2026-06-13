import { parseDesignSystemRenameArgs } from './design-system-rename-args.js';
import {
  DESIGN_SYSTEMS_USAGE,
  isDesignSystemsHelpArg,
} from './design-systems-cli-help.js';

type ParsedFlags = Record<string, string | boolean | undefined>;
type FlagOptions = {
  readonly string: ReadonlySet<string>;
  readonly boolean: ReadonlySet<string>;
};

export type DesignSystemsCliDeps = {
  readonly fetchImpl: typeof fetch;
  readonly libraryDaemonUrl: (flags: ParsedFlags) => Promise<string>;
  readonly runLibraryList: (name: 'design-systems', args: readonly string[]) => Promise<void> | void;
  readonly structuredHttpFailure: (resp: Response) => Promise<void> | void;
  readonly io: {
    readonly log: (message: string) => void;
    readonly error: (message: string) => void;
    readonly write: (message: string) => void;
    readonly exit: (code: number) => never;
  };
};

const LIBRARY_STRING_FLAGS = new Set(['daemon-url', 'query', 'tag']);
const LIBRARY_BOOLEAN_FLAGS = new Set(['help', 'h', 'json']);

export async function runDesignSystemsCli(
  args: readonly string[],
  deps: DesignSystemsCliDeps,
): Promise<void> {
  const subcommand = args[0];
  if (subcommand === 'rename') return await runDesignSystemRename(args.slice(1), deps);
  if (subcommand === 'import-local') return await runDesignSystemImportLocal(args.slice(1), deps);
  if (subcommand === 'import-github') return await runDesignSystemImportGithub(args.slice(1), deps);
  if (subcommand === 'import-shadcn') return await runDesignSystemImportShadcn(args.slice(1), deps);
  if (!subcommand || isDesignSystemsHelpArg(subcommand)) {
    deps.io.log(DESIGN_SYSTEMS_USAGE);
    deps.io.exit(isDesignSystemsHelpArg(subcommand) ? 0 : 2);
  }
  return await deps.runLibraryList('design-systems', args);
}

async function runDesignSystemImportLocal(
  args: readonly string[],
  deps: DesignSystemsCliDeps,
): Promise<void> {
  if (isSubcommandHelp(args)) {
    deps.io.log(`Usage:
  od design-systems import-local <path> [--name <name>] [--import-mode <mode>] [--craft <slugs>] [--json] [--daemon-url <url>]
  od design-systems import-local --path <path> [--name <name>] [--json]`);
    deps.io.exit(args.length === 0 ? 2 : 0);
  }
  const stringFlags = new Set([...LIBRARY_STRING_FLAGS, 'path', 'name', 'import-mode', 'craft']);
  const flags = parseFlags(args, { string: stringFlags, boolean: LIBRARY_BOOLEAN_FLAGS });
  const localPath = stringFlag(flags, 'path') ?? positionalArgs(args, stringFlags)[0];
  if (!localPath) {
    deps.io.error('Usage: od design-systems import-local <path>');
    deps.io.exit(2);
  }
  const pathModule = await import('node:path');
  return await postDesignSystemImport(
    deps,
    flags,
    '/api/design-systems/import/local',
    designSystemImportRequestBody(flags, { baseDir: pathModule.resolve(localPath) }),
  );
}

async function runDesignSystemImportGithub(
  args: readonly string[],
  deps: DesignSystemsCliDeps,
): Promise<void> {
  if (isSubcommandHelp(args)) {
    deps.io.log(`Usage:
  od design-systems import-github <url> [--branch <branch>] [--name <name>] [--import-mode <mode>] [--craft <slugs>] [--json] [--daemon-url <url>]
  od design-systems import-github --url <url> [--branch <branch>] [--json]`);
    deps.io.exit(args.length === 0 ? 2 : 0);
  }
  const stringFlags = new Set([...LIBRARY_STRING_FLAGS, 'url', 'branch', 'name', 'import-mode', 'craft']);
  const flags = parseFlags(args, { string: stringFlags, boolean: LIBRARY_BOOLEAN_FLAGS });
  const url = stringFlag(flags, 'url') ?? positionalArgs(args, stringFlags)[0];
  if (!url) {
    deps.io.error('Usage: od design-systems import-github <url>');
    deps.io.exit(2);
  }
  return await postDesignSystemImport(
    deps,
    flags,
    '/api/design-systems/import/github',
    designSystemImportRequestBody(flags, {
      url,
      ...(stringFlag(flags, 'branch') ? { branch: stringFlag(flags, 'branch') } : {}),
    }),
  );
}

async function runDesignSystemImportShadcn(
  args: readonly string[],
  deps: DesignSystemsCliDeps,
): Promise<void> {
  if (isSubcommandHelp(args)) {
    deps.io.log(`Usage:
  od design-systems import-shadcn <reference> [--name <name>] [--import-mode <mode>] [--craft <slugs>] [--json] [--daemon-url <url>]`);
    deps.io.exit(args.length === 0 ? 2 : 0);
  }
  const stringFlags = new Set([...LIBRARY_STRING_FLAGS, 'name', 'import-mode', 'craft']);
  const flags = parseFlags(args, { string: stringFlags, boolean: LIBRARY_BOOLEAN_FLAGS });
  const reference = positionalArgs(args, stringFlags)[0];
  if (!reference) {
    deps.io.error('Usage: od design-systems import-shadcn <reference>');
    deps.io.exit(2);
  }
  return await postDesignSystemImport(
    deps,
    flags,
    '/api/design-systems/import/shadcn',
    designSystemImportRequestBody(flags, { reference }),
  );
}

async function runDesignSystemRename(
  args: readonly string[],
  deps: DesignSystemsCliDeps,
): Promise<void> {
  if (isSubcommandHelp(args)) {
    deps.io.log(`Usage:
  od design-systems rename <id> --title <new-title> [--json] [--daemon-url <url>]
  od design-systems rename <id> "<new title>" [--json]`);
    deps.io.exit(args.length === 0 ? 2 : 0);
  }
  const parsed = parseDesignSystemRenameArgs([...args]);
  if (!parsed) {
    deps.io.error('Usage: od design-systems rename <id> --title <new-title>');
    deps.io.exit(2);
  }
  const flags = parseFlags(args, {
    string: new Set([...LIBRARY_STRING_FLAGS, 'title']),
    boolean: LIBRARY_BOOLEAN_FLAGS,
  });
  const base = (await deps.libraryDaemonUrl(flags)).replace(/\/$/, '');
  const resp = await deps.fetchImpl(`${base}/api/design-systems/${encodeURIComponent(parsed.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: parsed.title }),
  });
  if (!resp.ok) return await deps.structuredHttpFailure(resp);
  const data = await resp.json() as unknown;
  if (flags.json === true) {
    deps.io.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  const renamed = objectField(data, 'designSystem') ?? data;
  const title = stringObjectField(renamed, 'title') ?? parsed.title;
  deps.io.log(`Renamed ${parsed.id} -> ${title}`);
}

async function postDesignSystemImport(
  deps: DesignSystemsCliDeps,
  flags: ParsedFlags,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  const base = (await deps.libraryDaemonUrl(flags)).replace(/\/$/, '');
  const resp = await deps.fetchImpl(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return await deps.structuredHttpFailure(resp);
  const data = await resp.json() as unknown;
  if (flags.json === true) {
    deps.io.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  const imported = objectField(data, 'designSystem') ?? data;
  const id = stringObjectField(imported, 'id') ?? '(unknown id)';
  const title = stringObjectField(imported, 'title');
  deps.io.log(`Imported ${id}${title ? ` -> ${title}` : ''}`);
}

function designSystemImportRequestBody(
  flags: ParsedFlags,
  baseBody: Record<string, unknown>,
): Record<string, unknown> {
  const craftApplies = stringFlag(flags, 'craft')
    ?.split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  return {
    ...baseBody,
    ...(stringFlag(flags, 'name') ? { name: stringFlag(flags, 'name') } : {}),
    ...(stringFlag(flags, 'import-mode') ? { importMode: stringFlag(flags, 'import-mode') } : {}),
    ...(craftApplies && craftApplies.length > 0 ? { craftApplies } : {}),
  };
}

function parseFlags(argv: readonly string[], opts: FlagOptions): ParsedFlags {
  const out: ParsedFlags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('-')) continue;
    const normalized = arg.replace(/^-+/, '');
    const eq = normalized.indexOf('=');
    const key = eq >= 0 ? normalized.slice(0, eq) : normalized;
    if (opts.boolean.has(key)) {
      out[key] = true;
      continue;
    }
    if (!opts.string.has(key)) continue;
    if (eq >= 0) {
      out[key] = normalized.slice(eq + 1);
      continue;
    }
    const value = argv[index + 1];
    if (value !== undefined && !value.startsWith('-')) {
      out[key] = value;
      index += 1;
    }
  }
  return out;
}

function positionalArgs(args: readonly string[], stringFlags: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg.startsWith('--')) {
      const key = arg.slice(2).split('=')[0] ?? '';
      if (!arg.includes('=') && stringFlags.has(key) && args[index + 1] && !args[index + 1]?.startsWith('-')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('-')) continue;
    out.push(arg);
  }
  return out;
}

function isSubcommandHelp(args: readonly string[]): boolean {
  return args.length === 0 || args[0] === 'help' || args.includes('--help') || args.includes('-h');
}

function stringFlag(flags: ParsedFlags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function objectField(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === 'object' && !Array.isArray(child)
    ? child as Record<string, unknown>
    : undefined;
}

function stringObjectField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : undefined;
}
