import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function spawnAgentCli(bin: string, argv: readonly string[]): Promise<number> {
  return await new Promise((resolve) => {
    const child = spawn(bin, [...argv], { stdio: 'inherit' });
    child.on('error', () => {
      resolve(127);
    });
    child.on('exit', (code) => {
      resolve(code ?? 0);
    });
  });
}

export async function readTextFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeTextFile(filePath: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
