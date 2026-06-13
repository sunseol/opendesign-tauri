import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DAEMON_ROOT = pathResolve(__dirname, '..');
const REPO_ROOT = pathResolve(__dirname, '../../..');
const CLI_SRC = pathResolve(__dirname, '../src/cli.ts');
const TSX_CLI = pathResolve(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs');

interface CapturedRequest {
  method: string;
  url: string;
  body: string;
}

let server: http.Server;
let baseUrl: string;
let scratchDir: string;
const requests: CapturedRequest[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      requests.push({ method: req.method ?? '', url: req.url ?? '', body });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      if (req.url === '/api/projects') {
        res.end(JSON.stringify({ project: { id: 'stub-project' }, conversationId: 'stub-conv' }));
      } else {
        res.end(JSON.stringify({ file: { name: 'stub-file' } }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('missing stub server address');
  baseUrl = `http://127.0.0.1:${addr.port}`;
  scratchDir = mkdtempSync(join(tmpdir(), 'od-files-cli-'));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  rmSync(scratchDir, { recursive: true, force: true });
});

beforeEach(() => {
  requests.length = 0;
});

function runCli(
  args: string[],
  options: { stdin?: string } = {},
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const child = spawn(process.execPath, [TSX_CLI, CLI_SRC, ...args], {
      cwd: DAEMON_ROOT,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 15_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(options.stdin ?? '');
  });
}

describe('od files write/upload ESM file reads', () => {
  it('writes stdin content through the project files endpoint', async () => {
    const result = await runCli(
      ['files', 'write', 'proj-1', 'notes/brief.md', '--daemon-url', baseUrl],
      { stdin: '# brief\nhello\n' },
    );

    expect(result.stderr).not.toMatch(/require is not defined|ERR_AMBIGUOUS_MODULE_SYNTAX/);
    expect(result.code).toBe(0);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/api/projects/proj-1/files',
    });
    expect(JSON.parse(requests[0]!.body)).toEqual({
      name: 'notes/brief.md',
      content: '# brief\nhello\n',
      encoding: 'utf8',
    });
  });

  it('uploads a local file using its basename by default', async () => {
    const localPath = join(scratchDir, 'hero.bin');
    writeFileSync(localPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await runCli(['files', 'upload', 'proj-1', localPath, '--daemon-url', baseUrl]);

    expect(result.stderr).not.toMatch(/require is not defined|ERR_AMBIGUOUS_MODULE_SYNTAX/);
    expect(result.code).toBe(0);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0]!.body)).toEqual({
      name: 'hero.bin',
      content: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
      encoding: 'base64',
    });
  });

  it('reads project metadata JSON into the create request body', async () => {
    const metadataPath = join(scratchDir, 'metadata.json');
    writeFileSync(metadataPath, JSON.stringify({ kind: 'template', templateId: 't-1' }));

    const result = await runCli([
      'project',
      'create',
      '--name',
      'From template',
      '--metadata-json',
      metadataPath,
      '--daemon-url',
      baseUrl,
    ]);

    expect(result.stderr).not.toMatch(/require is not defined|ERR_AMBIGUOUS_MODULE_SYNTAX/);
    expect(result.code).toBe(0);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0]!.body)).toMatchObject({
      name: 'From template',
      metadata: { kind: 'template', templateId: 't-1' },
    });
  });
});
