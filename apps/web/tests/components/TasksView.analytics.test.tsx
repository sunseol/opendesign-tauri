// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Routine } from '@open-design/contracts';

import { TasksView } from '../../src/components/TasksView';

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

vi.mock('../../src/components/NewAutomationModal', () => ({
  NewAutomationModal: ({
    open,
    onSaved,
  }: {
    open: boolean;
    onSaved: (routine: Routine) => void;
  }) => {
    if (!open) return null;
    return (
      <button
        type="button"
        data-testid="mock-save-routine"
        onClick={() =>
          onSaved({
            id: 'routine-new',
            name: 'Fresh automation',
            prompt: 'Run scheduled work.',
            schedule: { kind: 'daily', time: '09:00', timezone: 'UTC' },
            target: { mode: 'create_each_run' },
            skillId: null,
            agentId: null,
            enabled: true,
            nextRunAt: null,
            lastRun: null,
            createdAt: 9000,
            updatedAt: 9000,
          })
        }
      >
        Mock save
      </button>
    );
  },
  describeScheduleSummary: () => 'Daily at 9:00',
}));

const originalFetch = globalThis.fetch;
const originalConfirm = window.confirm;

function makeRoutine(overrides: Partial<Routine> & Pick<Routine, 'id' | 'name'>): Routine {
  return {
    prompt: 'Run scheduled work.',
    schedule: { kind: 'daily', time: '09:00', timezone: 'UTC' },
    target: { mode: 'create_each_run' },
    skillId: null,
    agentId: null,
    enabled: true,
    nextRunAt: null,
    lastRun: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function uiClickPayloads(): Record<string, unknown>[] {
  return mockedTrack.mock.calls.flatMap(([event, payload]) =>
    event === 'ui_click' ? [payload] : [],
  );
}

function expectAutomationClick(payload: Record<string, unknown>): void {
  expect(uiClickPayloads()).toContainEqual({
    page_name: 'automations',
    area: 'automations',
    ...payload,
  });
}

function expectEnabledButton(name: string): HTMLButtonElement {
  const button = screen.getByRole('button', { name }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  return button;
}

function mockTasksFetch(routine: Routine): void {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url === '/api/routines' && (!init || init.method === undefined)) {
      return new Response(JSON.stringify({ routines: [routine] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/projects' && (!init || init.method === undefined)) {
      return new Response(JSON.stringify({ projects: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/automation-templates') {
      return new Response(JSON.stringify({ templates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/automation-proposals?status=pending-review') {
      return new Response(JSON.stringify({ proposals: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/automation-source-packets?limit=3') {
      return new Response(JSON.stringify({ packets: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === `/api/routines/${routine.id}/run` && init?.method === 'POST') {
      return new Response(JSON.stringify({}), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === `/api/routines/${routine.id}` && init?.method === 'PATCH') {
      return new Response(JSON.stringify({ routine: { ...routine, enabled: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === `/api/routines/${routine.id}` && init?.method === 'DELETE') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === `/api/routines/${routine.id}/runs?limit=10`) {
      return new Response(JSON.stringify({ runs: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;
}

describe('TasksView automation analytics', () => {
  afterEach(() => {
    cleanup();
    mockedTrack.mockClear();
    globalThis.fetch = originalFetch;
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it('emits ui_click events for automation tab actions', async () => {
    const routine = makeRoutine({ id: 'routine-1', name: 'Morning briefing' });
    mockTasksFetch(routine);
    window.confirm = vi.fn(() => true);

    render(<TasksView />);
    await screen.findByText('Morning briefing');

    fireEvent.click(screen.getByTestId('automations-new'));
    fireEvent.click(screen.getByTestId('mock-save-routine'));
    fireEvent.click(screen.getByRole('tab', { name: /Memory/i }));
    fireEvent.click(screen.getByRole('button', { name: /Refresh project memory/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    fireEvent.click(expectEnabledButton('Run'));
    await waitFor(() => expectAutomationClick({ element: 'run_now' }));
    fireEvent.click(expectEnabledButton('Pause'));
    await waitFor(() => expectAutomationClick({ element: 'pause' }));
    fireEvent.click(expectEnabledButton('Delete automation'));

    await waitFor(() => expect(uiClickPayloads().length).toBeGreaterThan(0));

    expectAutomationClick({ element: 'new_automation' });
    expectAutomationClick({ element: 'create' });
    expectAutomationClick({ element: 'filter_tab', filter_id: 'memory' });
    expectAutomationClick({ element: 'type_card', template_kind: 'routine' });
    expectAutomationClick({ element: 'run_now' });
    expectAutomationClick({ element: 'history' });
    expectAutomationClick({ element: 'edit' });
    expectAutomationClick({ element: 'pause' });
    expectAutomationClick({ element: 'delete' });
  });
});
