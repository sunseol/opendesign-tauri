import { describe, expect, it } from 'vitest';

import {
  browserCommentFilePath,
  isProjectHtmlBrowserUrl,
  projectRelativePathFromBrowserUrl,
} from '../../src/components/design-browser-tools';

describe('browser tool file targeting', () => {
  it('treats localhost dev-server pages as browser targets', () => {
    const url = 'http://localhost:3000/src/App.jsx';

    expect(browserCommentFilePath(url, '/Users/me/project')).toBe(`browser:${url}`);
    expect(projectRelativePathFromBrowserUrl(url, '/Users/me/project')).toBeNull();
    expect(isProjectHtmlBrowserUrl(url, '/Users/me/project')).toBe(false);
  });

  it('maps project-local file HTML pages back to editable project files', () => {
    const url = 'file:///Users/me/project/dist/index.html';

    expect(browserCommentFilePath(url, '/Users/me/project')).toBe('dist/index.html');
    expect(projectRelativePathFromBrowserUrl(url, '/Users/me/project')).toBe('dist/index.html');
    expect(isProjectHtmlBrowserUrl(url, '/Users/me/project')).toBe(true);
  });

  it('keeps project-local non-HTML files as commentable browser targets', () => {
    const url = 'file:///Users/me/project/src/App.jsx';

    expect(browserCommentFilePath(url, '/Users/me/project')).toBe('src/App.jsx');
    expect(projectRelativePathFromBrowserUrl(url, '/Users/me/project')).toBe('src/App.jsx');
    expect(isProjectHtmlBrowserUrl(url, '/Users/me/project')).toBe(false);
  });

  it('does not treat sibling path prefixes as project files', () => {
    const url = 'file:///Users/me/project-other/index.html';

    expect(projectRelativePathFromBrowserUrl(url, '/Users/me/project')).toBeNull();
    expect(browserCommentFilePath(url, '/Users/me/project')).toBe(`browser:${url}`);
  });

  it('decodes file URL path segments before deriving project-relative paths', () => {
    const url = 'file:///Users/me/project/assets/My%20Logo.png';

    expect(projectRelativePathFromBrowserUrl(url, '/Users/me/project')).toBe('assets/My Logo.png');
  });
});
