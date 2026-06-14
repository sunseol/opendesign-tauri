// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectView } from '../../src/components/ProjectView';
import type {
  AgentInfo,
  AppConfig,
  ChatMessage,
  Conversation,
  DesignSystemSummary,
  Project,
  SkillSummary,
} from '../../src/types';
import {
  createConversation,
  listConversations,
  listMessages,
} from '../../src/state/projects';
import { fetchPreviewComments } from '../../src/providers/registry';

vi.mock('../../src/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: () => undefined,
    t: (key: string) => key,
  }),
  useT: () => (key: string) => key,
}));

vi.mock('../../src/router', () => ({
  navigate: vi.fn(),
}));

vi.mock('../../src/providers/anthropic', () => ({
  streamMessage: vi.fn(),
}));

vi.mock('../../src/providers/daemon', () => ({
  fetchChatRunStatus: vi.fn(),
  listActiveChatRuns: vi.fn().mockResolvedValue([]),
  listProjectRuns: vi.fn().mockResolvedValue([]),
  reattachDaemonRun: vi.fn(),
  streamViaDaemon: vi.fn(),
}));

vi.mock('../../src/providers/project-events', () => ({
  useProjectFileEvents: vi.fn(),
}));

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>(
    '../../src/providers/registry',
  );
  return {
    ...actual,
    deletePreviewComment: vi.fn(),
    fetchDesignSystem: vi.fn(),
    fetchLiveArtifacts: vi.fn().mockResolvedValue([]),
    fetchPreviewComments: vi.fn(),
    fetchProjectFiles: vi.fn().mockResolvedValue([]),
    fetchSkill: vi.fn(),
    getTemplate: vi.fn(),
    patchPreviewCommentStatus: vi.fn(),
    upsertPreviewComment: vi.fn(),
    writeProjectTextFile: vi.fn(),
  };
});

vi.mock('../../src/state/projects', async () => {
  const actual = await vi.importActual<typeof import('../../src/state/projects')>(
    '../../src/state/projects',
  );
  return {
    ...actual,
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    loadTabs: vi.fn().mockResolvedValue({ tabs: [], active: null }),
    patchConversation: vi.fn(),
    patchProject: vi.fn(),
    saveMessage: vi.fn(),
    saveTabs: vi.fn(),
    synthesizeHandoff: vi.fn(),
  };
});

vi.mock('../../src/components/AppChromeHeader', () => ({
  AppChromeHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}));

vi.mock('../../src/components/AvatarMenu', () => ({ AvatarMenu: () => null }));

vi.mock('../../src/components/FileWorkspace', () => ({
  FileWorkspace: () => <div data-testid="file-workspace" />,
}));

vi.mock('../../src/components/Loading', () => ({
  CenteredLoader: () => <div data-testid="loader" />,
}));

vi.mock('../../src/components/ChatPane', () => ({
  ChatPane: ({
    forkConversationDisabled,
    messages,
    onForkConversation,
  }: {
    forkConversationDisabled?: boolean;
    messages: ChatMessage[];
    onForkConversation?: (assistantMessage: ChatMessage) => void;
  }) => {
    const assistant = messages.find((message) => message.id === 'assistant-1');
    return (
      <div>
        <button
          type="button"
          data-testid="fork"
          disabled={forkConversationDisabled}
          onClick={() => {
            if (assistant) onForkConversation?.(assistant);
          }}
        />
        <div data-testid="messages">
          {messages.map((message) => `${message.role}:${message.content}`).join('|')}
        </div>
      </div>
    );
  },
}));

const mockedCreateConversation = vi.mocked(createConversation);
const mockedFetchPreviewComments = vi.mocked(fetchPreviewComments);
const mockedListConversations = vi.mocked(listConversations);
const mockedListMessages = vi.mocked(listMessages);

const config: AppConfig = {
  mode: 'api',
  apiKey: 'sk-test',
  baseUrl: '',
  model: 'claude-opus-4-7',
  agentId: null,
  skillId: null,
  designSystemId: null,
};

const project: Project = {
  id: 'p1',
  name: 'Project p1',
  skillId: null,
  designSystemId: null,
  createdAt: 1,
  updatedAt: 1,
};

const sourceConversation: Conversation = {
  id: 'conv-source',
  projectId: 'p1',
  title: 'Original',
  createdAt: 1,
  updatedAt: 1,
};

const forkedConversation: Conversation = {
  id: 'conv-fork',
  projectId: 'p1',
  title: 'Original fork',
  createdAt: 2,
  updatedAt: 2,
};

const sourceMessages: ChatMessage[] = [
  { id: 'user-1', role: 'user', content: 'Start' },
  {
    id: 'assistant-1',
    role: 'assistant',
    content: 'First answer',
    runId: 'run-1',
    runStatus: 'succeeded',
  },
  { id: 'user-2', role: 'user', content: 'Future question' },
];

const emptyAgents: AgentInfo[] = [];
const emptySkills: SkillSummary[] = [];
const emptyDesignSystems: DesignSystemSummary[] = [];

function renderProjectView() {
  return render(
    <ProjectView
      project={project}
      routeFileName={null}
      config={config}
      agents={emptyAgents}
      skills={emptySkills}
      designTemplates={emptySkills}
      designSystems={emptyDesignSystems}
      daemonLive
      onModeChange={vi.fn()}
      onAgentChange={vi.fn()}
      onAgentModelChange={vi.fn()}
      onRefreshAgents={vi.fn()}
      onOpenSettings={vi.fn()}
      onBack={vi.fn()}
      onClearPendingPrompt={vi.fn()}
      onTouchProject={vi.fn()}
      onProjectChange={vi.fn()}
      onProjectsRefresh={vi.fn()}
    />,
  );
}

describe('ProjectView fork conversation', () => {
  beforeEach(() => {
    mockedCreateConversation.mockResolvedValue(forkedConversation);
    mockedFetchPreviewComments.mockResolvedValue([]);
    mockedListConversations.mockResolvedValue([sourceConversation]);
    mockedListMessages.mockImplementation(async (_projectId, conversationId) =>
      conversationId === sourceConversation.id ? sourceMessages : [],
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates a seeded fork from the selected assistant turn', async () => {
    renderProjectView();

    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toContain('assistant:First answer');
    });

    fireEvent.click(screen.getByTestId('fork'));

    await waitFor(() => {
      expect(mockedCreateConversation).toHaveBeenCalledWith('p1', {
        forkAfterMessageId: 'assistant-1',
        seedFromConversationId: 'conv-source',
        seedMessages: [
          { id: 'user-1', role: 'user', content: 'Start' },
          { id: 'assistant-1', role: 'assistant', content: 'First answer' },
        ],
        title: 'Original fork',
      });
    });
  });
});
