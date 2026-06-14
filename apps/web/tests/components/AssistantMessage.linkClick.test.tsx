// @vitest-environment jsdom

/**
 * End-to-end coverage for chat file-link routing (issue #1239).
 *
 * Before this fix, every `<a>` rendered from chat markdown carried
 * `target="_blank"` with no `onClick`. The desktop shell can then open
 * a new app context; relative hrefs like `template.html` have no base
 * there, so the new context can't resolve them and the user lands on the
 * home screen. The fix detects in-project
 * file paths in chat markdown and routes them through the existing
 * `requestOpenFile` workspace tab opener.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssistantMessage } from '../../src/components/AssistantMessage';
import type { ChatMessage } from '../../src/types';

afterEach(() => cleanup());

function messageWithText(text: string): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: text,
    events: [{ kind: 'text', text }],
    startedAt: 1_000,
    endedAt: 3_000,
    runStatus: 'succeeded',
  };
}

function onlyAnchor(container: HTMLElement): HTMLAnchorElement {
  const anchor = container.querySelector<HTMLAnchorElement>('a.md-link');
  expect(anchor).not.toBeNull();
  if (!anchor) throw new Error('missing assistant link');
  return anchor;
}

describe('AssistantMessage — chat file-link routing (#1239)', () => {
  it('routes a relative file-link click through onRequestOpenFile and suppresses the default new-window behavior', () => {
    const onRequestOpenFile = vi.fn();
    const { container } = render(
      <AssistantMessage
        message={messageWithText('Open [template.html](template.html) to preview.')}
        streaming={false}
        projectId="project-1"
        onRequestOpenFile={onRequestOpenFile}
      />,
    );

    const anchor = onlyAnchor(container);
    expect(anchor.getAttribute('href')).toBe('template.html');

    // Dispatch a real DOM MouseEvent so defaultPrevented reflects what
    // the shell/default browser behavior actually reads.
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(clickEvent);

    expect(onRequestOpenFile).toHaveBeenCalledTimes(1);
    expect(onRequestOpenFile).toHaveBeenCalledWith('template.html');
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('normalizes ./ and nested subdirectory paths before opening', () => {
    const onRequestOpenFile = vi.fn();
    const { container } = render(
      <AssistantMessage
        message={messageWithText('Inspect [hero](./subdir/hero.html) section.')}
        streaming={false}
        projectId="project-1"
        onRequestOpenFile={onRequestOpenFile}
      />,
    );

    fireEvent.click(onlyAnchor(container));
    expect(onRequestOpenFile).toHaveBeenCalledTimes(1);
    expect(onRequestOpenFile).toHaveBeenCalledWith('subdir/hero.html');
  });

  it('routes absolute assistant file links when they match a known project file', () => {
    const onRequestOpenFile = vi.fn();
    const { container } = render(
      <AssistantMessage
        message={messageWithText(
          'Open [index.html](/Users/mac/open-design/open-design-preview-0.10.0/projects/Web%20Prototype/index.html).',
        )}
        streaming={false}
        projectId="project-1"
        projectFileNames={new Set(['index.html'])}
        onRequestOpenFile={onRequestOpenFile}
      />,
    );

    fireEvent.click(onlyAnchor(container));
    expect(onRequestOpenFile).toHaveBeenCalledTimes(1);
    expect(onRequestOpenFile).toHaveBeenCalledWith('index.html');
  });

  it('does not intercept external https:// URLs — preserves default target="_blank" behavior', () => {
    const onRequestOpenFile = vi.fn();
    const { container } = render(
      <AssistantMessage
        message={messageWithText('See [docs](https://example.com/docs) for context.')}
        streaming={false}
        projectId="project-1"
        onRequestOpenFile={onRequestOpenFile}
      />,
    );

    const anchor = onlyAnchor(container);
    expect(anchor.getAttribute('href')).toBe('https://example.com/docs');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(clickEvent);
    expect(onRequestOpenFile).not.toHaveBeenCalled();
    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it('does not intercept #anchor fragments', () => {
    const onRequestOpenFile = vi.fn();
    const { container } = render(
      <AssistantMessage
        message={messageWithText('Jump to [intro](#intro) of this page.')}
        streaming={false}
        projectId="project-1"
        onRequestOpenFile={onRequestOpenFile}
      />,
    );

    fireEvent.click(onlyAnchor(container));
    expect(onRequestOpenFile).not.toHaveBeenCalled();
  });

  it('keeps default link behavior when the host did not pass onRequestOpenFile', () => {
    // Some surfaces (e.g. read-only history view) intentionally do not
    // pass `onRequestOpenFile`. The fix must not throw and the link must
    // still render with its default target="_blank" behavior.
    const { container } = render(
      <AssistantMessage
        message={messageWithText('Open [template.html](template.html) to preview.')}
        streaming={false}
        projectId="project-1"
      />,
    );

    const anchor = onlyAnchor(container);
    expect(anchor.getAttribute('target')).toBe('_blank');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(false);
  });
});
