import { describe, expect, it } from 'vitest';

import {
  PROJECT_EXPORT_MANIFEST_SCHEMA,
  buildProjectRawFileUrl,
} from '../src/api/files';

describe('project file contracts', () => {
  it('builds raw project file URLs with path segment encoding', () => {
    expect(
      buildProjectRawFileUrl(
        'http://127.0.0.1:7456/',
        'project 1',
        'screens/main page.html',
      ),
    ).toBe('http://127.0.0.1:7456/api/projects/project%201/raw/screens/main%20page.html');
  });

  it('returns null for missing raw file paths', () => {
    expect(buildProjectRawFileUrl('http://127.0.0.1:7456', 'project-1', '')).toBeNull();
    expect(buildProjectRawFileUrl('http://127.0.0.1:7456', 'project-1', null)).toBeNull();
  });

  it('exports the project export manifest schema literal', () => {
    expect(PROJECT_EXPORT_MANIFEST_SCHEMA).toBe('open-design.project-export-manifest.v1');
  });
});
