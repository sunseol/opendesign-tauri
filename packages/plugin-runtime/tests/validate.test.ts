import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/validate';

describe('validateManifest', () => {
  it('flags repeat=true without an until expression', () => {
    const result = validateManifest({
      name: 'x',
      version: '1.0.0',
      od: {
        pipeline: { stages: [{ id: 'critique', atoms: ['critique-theater'], repeat: true }] },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/until/);
  });

  it('warns on unknown capability strings but stays ok', () => {
    const result = validateManifest({
      name: 'x',
      version: '1.0.0',
      od: { capabilities: ['prompt:inject', 'made-up'] },
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes('made-up'))).toBe(true);
  });

  it('rejects an oauth surface that points at an undeclared connector', () => {
    const result = validateManifest({
      name: 'x',
      version: '1.0.0',
      od: {
        connectors: { required: [{ id: 'slack', tools: [] }] },
        genui: {
          surfaces: [
            {
              id: 's1',
              kind: 'oauth-prompt',
              persist: 'project',
              oauth: { route: 'connector', connectorId: 'notion' },
            },
          ],
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects plugin-local manifest paths that escape the plugin folder', () => {
    const result = validateManifest({
      name: 'x',
      version: '1.0.0',
      od: {
        preview: { type: 'html', entry: '/tmp/preview.html' },
        context: { assets: ['./safe.csv', '../secret.csv'] },
        useCase: {
          exampleOutputs: [{ path: 'examples/demo' }, { path: '..\\secret' }],
        },
        genui: {
          surfaces: [
            {
              id: 'panel',
              kind: 'choice',
              persist: 'run',
              component: { path: '../panel.tsx' },
            },
          ],
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('preview.entry');
    expect(result.errors.join('\n')).toContain('context.assets[1]');
    expect(result.errors.join('\n')).toContain('useCase.exampleOutputs[1].path');
    expect(result.errors.join('\n')).toContain('genui.surfaces[panel].component.path');
  });

  it('allows remote preview media while keeping entry paths local', () => {
    const result = validateManifest({
      name: 'x',
      version: '1.0.0',
      icon: 'https://cdn.example.com/icon.svg',
      od: {
        preview: {
          type: 'html',
          entry: './preview/index.html',
          poster: 'https://cdn.example.com/poster.png',
          video: 'https://cdn.example.com/demo.mp4',
          gif: './preview/demo.gif',
        },
        context: { assets: ['./assets/sample.csv'] },
      },
    });

    expect(result.ok).toBe(true);
  });

  it('rejects unsafe compat paths even without an od block', () => {
    const result = validateManifest({
      name: 'x',
      version: '1.0.0',
      compat: { agentSkills: [{ path: '../SKILL.md' }] },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('compat.agentSkills[0].path');
  });
});
