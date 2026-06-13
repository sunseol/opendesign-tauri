import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webSourcePrefixes = ["apps/web/app/", "apps/web/src/"];
const webSourceExtensions = new Set([".ts", ".tsx"]);
const skippedDirectories = new Set([
  ".next",
  "dist",
  "node_modules",
  "out",
  "reports",
  "test-results",
]);
const forbiddenPackages = [
  "@open-design/platform",
  "@open-design/sidecar",
  "@open-design/sidecar-proto",
];
const forbiddenDaemonRoots = [
  "apps/daemon/src",
  "apps/daemon/tests",
];
const forbiddenPackageRoots = [
  "packages/platform",
  "packages/sidecar",
  "packages/sidecar-proto",
];

export type WebImportIsolationViolation = {
  filePath: string;
  lineNumber: number;
  specifier: string;
  reason: string;
};

type SourceImportSpecifier = {
  lineNumber: number;
  specifier: string;
};

export function isWebImportIsolationSourcePath(repositoryPath: string): boolean {
  return (
    webSourcePrefixes.some((prefix) => repositoryPath.startsWith(prefix)) &&
    webSourceExtensions.has(path.extname(repositoryPath))
  );
}

function pushStringSpecifier(
  imports: SourceImportSpecifier[],
  sourceFile: ts.SourceFile,
  node: ts.Node | undefined,
): void {
  if (node == null) return;
  if (!ts.isStringLiteralLike(node)) return;
  imports.push({
    lineNumber: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    specifier: node.text,
  });
}

function collectImportSpecifiersFromSource(repositoryPath: string, source: string): SourceImportSpecifier[] {
  const sourceFile = ts.createSourceFile(
    repositoryPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    repositoryPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports: SourceImportSpecifier[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      pushStringSpecifier(imports, sourceFile, node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      pushStringSpecifier(imports, sourceFile, node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      pushStringSpecifier(imports, sourceFile, node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return imports;
}

function isPackageOrSubpath(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function isPathOrDescendant(repositoryPath: string, root: string): boolean {
  return repositoryPath === root || repositoryPath.startsWith(`${root}/`);
}

function resolveWebImportRepositoryPath(fromRepositoryPath: string, specifier: string): string | null {
  const pathOnly = specifier.split(/[?#]/, 1)[0];
  if (!pathOnly) return null;

  if (pathOnly.startsWith("@/")) {
    return path.posix.normalize(path.posix.join("apps/web", pathOnly.slice("@/".length)));
  }

  if (!pathOnly.startsWith(".")) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRepositoryPath), pathOnly));
}

function violationReason(fromRepositoryPath: string, specifier: string): string | null {
  if (forbiddenPackages.some((packageName) => isPackageOrSubpath(specifier, packageName))) {
    return "apps/web must not import sidecar or platform control-plane packages directly";
  }

  const resolvedPath = resolveWebImportRepositoryPath(fromRepositoryPath, specifier);
  if (resolvedPath == null) return null;

  if (forbiddenDaemonRoots.some((root) => isPathOrDescendant(resolvedPath, root))) {
    return "apps/web must use daemon HTTP APIs or @open-design/contracts instead of daemon private source";
  }

  if (forbiddenPackageRoots.some((root) => isPathOrDescendant(resolvedPath, root))) {
    return "apps/web must not import sidecar or platform control-plane source directly";
  }

  return null;
}

export function collectWebImportIsolationViolationsFromSource(
  repositoryPath: string,
  source: string,
): WebImportIsolationViolation[] {
  if (!isWebImportIsolationSourcePath(repositoryPath)) return [];

  return collectImportSpecifiersFromSource(repositoryPath, source).flatMap((sourceImport) => {
    const reason = violationReason(repositoryPath, sourceImport.specifier);
    if (reason == null) return [];
    return [{
      filePath: repositoryPath,
      lineNumber: sourceImport.lineNumber,
      specifier: sourceImport.specifier,
      reason,
    }];
  });
}

function toRepositoryPath(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

async function collectRepositoryFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        files.push(...(await collectRepositoryFiles(fullPath)));
      }
      continue;
    }

    if (entry.isFile()) files.push(toRepositoryPath(fullPath));
  }

  return files;
}

async function repositoryDirectoryExists(repositoryPath: string): Promise<boolean> {
  try {
    await access(path.join(repoRoot, repositoryPath));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return false;
    }
    throw error;
  }
}

export async function checkWebImportIsolation(): Promise<boolean> {
  const violations: WebImportIsolationViolation[] = [];

  for (const repositoryPrefix of webSourcePrefixes) {
    const repositoryDirectory = repositoryPrefix.replace(/\/$/, "");
    if (!(await repositoryDirectoryExists(repositoryDirectory))) continue;

    for (const repositoryPath of await collectRepositoryFiles(path.join(repoRoot, repositoryDirectory))) {
      if (!isWebImportIsolationSourcePath(repositoryPath)) continue;
      const source = await readFile(path.join(repoRoot, repositoryPath), "utf8");
      violations.push(...collectWebImportIsolationViolationsFromSource(repositoryPath, source));
    }
  }

  if (violations.length > 0) {
    console.error("Web import isolation violations found:");
    for (const violation of violations) {
      console.error(
        `- ${violation.filePath}:${violation.lineNumber} \`${violation.specifier}\` -> ${violation.reason}`,
      );
    }
    return false;
  }

  console.log("Web import isolation check passed: web runtime imports stay behind contracts and daemon HTTP APIs.");
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ok = await checkWebImportIsolation();
  if (!ok) process.exitCode = 1;
}
