import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const docsI18nDirectory = path.join(repoRoot, "docs", "i18n");

const requiredDocs = [
  "CONTRIBUTING.de.md",
  "CONTRIBUTING.fr.md",
  "CONTRIBUTING.ja-JP.md",
  "CONTRIBUTING.ko.md",
  "CONTRIBUTING.pt-BR.md",
  "CONTRIBUTING.zh-CN.md",
  "MAINTAINERS.de.md",
  "MAINTAINERS.fr.md",
  "MAINTAINERS.ja-JP.md",
  "MAINTAINERS.ko.md",
  "MAINTAINERS.pt-BR.md",
  "MAINTAINERS.zh-CN.md",
  "QUICKSTART.de.md",
  "QUICKSTART.fr.md",
  "QUICKSTART.ja-JP.md",
  "QUICKSTART.ko.md",
  "QUICKSTART.pt-BR.md",
  "QUICKSTART.zh-CN.md",
  "QUICKSTART.zh-TW.md",
  "README.ar.md",
  "README.de.md",
  "README.es.md",
  "README.fr.md",
  "README.ja-JP.md",
  "README.ko.md",
  "README.pt-BR.md",
  "README.ru.md",
  "README.tr.md",
  "README.uk.md",
  "README.zh-CN.md",
  "README.zh-TW.md",
] as const;

function repositoryPath(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

async function listTranslatedDocs(): Promise<Set<string>> {
  try {
    return new Set((await readdir(docsI18nDirectory)).filter((entry) => entry.endsWith(".md")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

async function isNonEmptyDoc(fileName: string): Promise<boolean> {
  const source = await readFile(path.join(docsI18nDirectory, fileName), "utf8");
  return source.trim().length > 0;
}

const existingDocs = await listTranslatedDocs();
const expectedDocs = new Set<string>(requiredDocs);
const errors: string[] = [];

for (const fileName of requiredDocs) {
  if (!existingDocs.has(fileName)) {
    errors.push(`${repositoryPath(path.join(docsI18nDirectory, fileName))} is missing.`);
    continue;
  }

  if (!(await isNonEmptyDoc(fileName))) {
    errors.push(`${repositoryPath(path.join(docsI18nDirectory, fileName))} is empty.`);
  }
}

for (const fileName of existingDocs) {
  if (!expectedDocs.has(fileName)) {
    errors.push(`${repositoryPath(path.join(docsI18nDirectory, fileName))} is not part of the upstream translated-docs baseline.`);
  }
}

if (errors.length > 0) {
  console.error("i18n docs check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("i18n docs check passed: docs/i18n contains the upstream translated-docs baseline.");
}
