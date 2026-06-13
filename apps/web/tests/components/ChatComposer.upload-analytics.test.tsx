// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer } from '../../src/components/ChatComposer';
import { uploadProjectFiles } from '../../src/providers/registry';

type Track = (
  event: string,
  properties: Record<string, unknown>,
  options?: { requestId?: string; insertId?: string },
) => void;

const { mockedTrack } = vi.hoisted(() => ({
  mockedTrack: vi.fn<Track>(),
}));

vi.mock('../../src/analytics/provider', () => ({
  useAnalytics: () => ({
    track: mockedTrack,
  }),
}));

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>(
    '../../src/providers/registry',
  );
  return {
    ...actual,
    uploadProjectFiles: vi.fn(),
  };
});

const mockedUploadProjectFiles = vi.mocked(uploadProjectFiles);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('ChatComposer upload analytics', () => {
  it('emits file_upload_result success when paperclip upload completes', async () => {
    mockedUploadProjectFiles.mockResolvedValue({
      uploaded: [{ path: 'brief.pdf', name: 'brief.pdf', kind: 'file', size: 5 }],
      failed: [],
    });

    renderComposer();

    uploadViaPaperclip([new File(['brief'], 'brief.pdf', { type: 'application/pdf' })]);

    await waitFor(() => {
      expectFileUploadResult({
        page_name: 'chat_panel',
        area: 'chat_composer',
        project_id: 'project-1',
        file_count: 1,
        file_type: 'pdf',
        file_size_bucket: '0_1mb',
        result: 'success',
      });
    });
  });

  it('emits file_upload_result failure when paperclip upload partially fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedUploadProjectFiles.mockResolvedValue({
      uploaded: [{ path: 'hero.png', name: 'hero.png', kind: 'image', size: 4 }],
      failed: [{ name: 'logo.png', error: 'permission denied' }],
      error: 'permission denied',
    });

    renderComposer();

    uploadViaPaperclip([
      new File(['hero'], 'hero.png', { type: 'image/png' }),
      new File(['logo'], 'logo.png', { type: 'image/png' }),
    ]);

    await waitFor(() => {
      expectFileUploadResult({
        page_name: 'chat_panel',
        area: 'chat_composer',
        project_id: 'project-1',
        file_count: 2,
        file_type: 'image',
        file_size_bucket: '0_1mb',
        result: 'failed',
        error_code: 'permission denied',
      });
    });
  });

  it('emits file_upload_result failure when paperclip upload rejects', async () => {
    mockedUploadProjectFiles.mockRejectedValue(new Error('storage offline'));

    renderComposer();

    uploadViaPaperclip([new File(['brief'], 'brief.pdf', { type: 'application/pdf' })]);

    await waitFor(() => {
      expectFileUploadResult({
        page_name: 'chat_panel',
        area: 'chat_composer',
        project_id: 'project-1',
        file_count: 1,
        file_type: 'pdf',
        file_size_bucket: '0_1mb',
        result: 'failed',
        error_code: 'storage offline',
      });
    });
  });
});

function renderComposer() {
  render(
    <ChatComposer
      projectId="project-1"
      projectFiles={[]}
      streaming={false}
      onEnsureProject={async () => 'project-1'}
      onSend={vi.fn()}
      onStop={vi.fn()}
    />,
  );
}

function uploadViaPaperclip(files: readonly File[]): void {
  fireEvent.change(screen.getByTestId('chat-file-input'), {
    target: {
      files,
    },
  });
}

function expectFileUploadResult(expected: Record<string, unknown>): void {
  const call = mockedTrack.mock.calls.find(([event]) => event === 'file_upload_result');
  if (!call) throw new Error('Expected file_upload_result event');
  expect(call[1]).toEqual(expected);
}
