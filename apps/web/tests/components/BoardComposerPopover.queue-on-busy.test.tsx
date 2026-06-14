// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BoardComposerPopover } from '../../src/components/BoardComposerPopover';
import type { PreviewCommentSnapshot } from '../../src/comments';
import type { Dict } from '../../src/i18n/types';

afterEach(() => {
  cleanup();
});

const target: PreviewCommentSnapshot = {
  filePath: 'index.html',
  elementId: 'hero-title',
  selector: '#hero-title',
  label: 'Hero title',
  text: '',
  position: { x: 0, y: 0, width: 100, height: 24 },
  htmlHint: '',
  selectionKind: 'element',
};

const labels: Partial<Record<keyof Dict, string>> = {
  'chat.comments.sendToChat': 'Send to chat',
  'chat.comments.sending': 'Sending...',
  'chat.comments.placeholder': 'Comment on this element...',
  'chat.comments.comment': 'Comment',
};

function t(key: keyof Dict): string {
  return labels[key] ?? String(key);
}

function requireSendButton(): HTMLButtonElement {
  const button = screen.getByTestId('comment-add-send');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('comment-add-send did not render as a button');
  }
  return button;
}

describe('BoardComposerPopover queue on busy conversation', () => {
  it('shows Queue and stays clickable while a run is in flight', () => {
    const onSendBatch = vi.fn();
    render(
      <BoardComposerPopover
        target={target}
        existing={null}
        draft="Make this text white"
        notes={[]}
        onDraft={() => {}}
        onAddDraft={() => {}}
        onRemoveQueuedNote={() => {}}
        onClose={() => {}}
        onSaveComment={() => {}}
        onSendBatch={onSendBatch}
        onRemove={() => {}}
        onRemoveMember={() => {}}
        sending={false}
        queueOnSend
        sendDisabled={false}
        t={t}
      />,
    );

    const send = requireSendButton();
    expect(send.textContent).toBe('Queue');
    expect(send.disabled).toBe(false);

    fireEvent.click(send);
    expect(onSendBatch).toHaveBeenCalledTimes(1);
  });

  it('shows Sending... only while the batch submit is in flight', () => {
    render(
      <BoardComposerPopover
        target={target}
        existing={null}
        draft="Make this text white"
        notes={[]}
        onDraft={() => {}}
        onAddDraft={() => {}}
        onRemoveQueuedNote={() => {}}
        onClose={() => {}}
        onSaveComment={() => {}}
        onSendBatch={() => {}}
        onRemove={() => {}}
        onRemoveMember={() => {}}
        sending
        queueOnSend
        sendDisabled={false}
        t={t}
      />,
    );

    const send = requireSendButton();
    expect(send.textContent).toBe('Sending...');
    expect(send.disabled).toBe(true);
  });
});
