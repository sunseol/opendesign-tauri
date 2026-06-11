import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { listFiles, reconcileHtmlArtifactManifest } from '../src/projects.js';

const tempRoots: string[] = [];

async function makeProjectsRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'od-artifact-reconcile-'));
  tempRoots.push(root);
  const projectsRoot = path.join(root, 'projects');
  await mkdir(path.join(projectsRoot, 'project-1'), { recursive: true });
  return projectsRoot;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('project HTML artifact manifest reconciliation', () => {
  it('does not reconcile dependency package HTML files as artifacts', async () => {
    const projectsRoot = await makeProjectsRoot();
    const dir = path.join(projectsRoot, 'project-1');
    await mkdir(path.join(dir, 'node_modules', 'tslib'), { recursive: true });
    await writeFile(
      path.join(dir, 'node_modules', 'tslib', 'tslib.html'),
      '<script src="tslib.js"></script>',
    );

    const result = await reconcileHtmlArtifactManifest(
      projectsRoot,
      'project-1',
      'node_modules/tslib/tslib.html',
    );

    expect(result).toBeNull();
    expect(existsSync(path.join(dir, 'node_modules', 'tslib', 'tslib.html.artifact.json'))).toBe(
      false,
    );
  });

  it('does not infer or surface Vite dev index.html as an HTML artifact', async () => {
    const projectsRoot = await makeProjectsRoot();
    const dir = path.join(projectsRoot, 'project-1');
    await writeFile(
      path.join(dir, 'index.html'),
      '<div id="root"></div><script type="module" src="/src/main.jsx"></script>',
    );
    await writeFile(path.join(dir, 'vite.config.js'), 'export default {};');

    const reconciled = await reconcileHtmlArtifactManifest(projectsRoot, 'project-1', 'index.html');
    expect(reconciled).toBeNull();
    expect(existsSync(path.join(dir, 'index.html.artifact.json'))).toBe(false);

    await writeFile(
      path.join(dir, 'index.html.artifact.json'),
      JSON.stringify({
        version: 1,
        kind: 'html',
        entry: 'index.html',
        renderer: 'html',
        status: 'complete',
        exports: ['html', 'zip'],
      }),
    );

    const files = await listFiles(projectsRoot, 'project-1');
    const index = files.find((file) => file.name === 'index.html');
    expect(index?.artifactManifest).toBeNull();
  });
});
