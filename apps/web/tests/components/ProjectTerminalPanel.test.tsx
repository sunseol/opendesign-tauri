// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TerminalSession } from '@open-design/contracts';

import { ProjectTerminalPanel } from '../../src/components/ProjectTerminalPanel';
import {
  createProjectTerminal,
  killProjectTerminal,
  resizeProjectTerminal,
  writeProjectTerminalInput,
} from '../../src/providers/registry';

vi.mock('../../src/providers/registry', () => ({
  createProjectTerminal: vi.fn(),
  killProjectTerminal: vi.fn(),
  projectTerminalStreamUrl: (projectId: string, terminalId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/terminals/${encodeURIComponent(terminalId)}/stream`,
  resizeProjectTerminal: vi.fn(),
  writeProjectTerminalInput: vi.fn(),
}));

const mockedCreateProjectTerminal = vi.mocked(createProjectTerminal);
const mockedKillProjectTerminal = vi.mocked(killProjectTerminal);
const mockedResizeProjectTerminal = vi.mocked(resizeProjectTerminal);
const mockedWriteProjectTerminalInput = vi.mocked(writeProjectTerminalInput);

class FakeEventSource {
  static readonly instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  readonly url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, payload: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(payload) }));
    }
  }
}

class FakeResizeObserver {
  static readonly instances: FakeResizeObserver[] = [];
  readonly observed = new Set<Element>();
  private callback: (entries: Array<{ contentRect: { height: number; width: number } }>) => void;

  constructor(callback: (entries: Array<{ contentRect: { height: number; width: number } }>) => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  disconnect(): void {
    this.observed.clear();
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  emit(width: number, height: number): void {
    this.callback([{ contentRect: { width, height } }]);
  }
}

afterEach(() => {
  cleanup();
  FakeEventSource.instances.length = 0;
  FakeResizeObserver.instances.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ProjectTerminalPanel', () => {
  it('starts a project terminal, streams output, sends stdin, and handles exit', async () => {
    mockedCreateProjectTerminal.mockResolvedValue(terminalSession({ status: 'running' }));
    mockedWriteProjectTerminalInput.mockResolvedValue(terminalSession({ updatedAt: 2 }));
    vi.stubGlobal('EventSource', FakeEventSource);

    render(<ProjectTerminalPanel projectId="project-1" />);

    expect(await screen.findByText('/tmp/project-1')).toBeTruthy();
    expect(FakeEventSource.instances[0]?.url).toBe('/api/projects/project-1/terminals/term-1/stream');

    act(() => {
      FakeEventSource.instances[0]?.emit('data', { data: 'ready\n' });
    });
    expect(screen.getByLabelText('Terminal output').textContent).toContain('ready');

    const input = screen.getByRole('textbox', { name: 'Terminal input' });
    if (!(input instanceof HTMLTextAreaElement)) throw new TypeError('Expected terminal textarea');
    fireEvent.change(input, { target: { value: 'pwd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send command' }));

    await waitFor(() => {
      expect(mockedWriteProjectTerminalInput).toHaveBeenCalledWith('project-1', 'term-1', 'pwd\n');
    });
    expect(input.value).toBe('');

    act(() => {
      FakeEventSource.instances[0]?.emit('exit', { code: 0, signal: null });
    });
    expect(screen.getByText('Exited 0')).toBeTruthy();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });

  it('kills the running terminal from the panel action', async () => {
    mockedCreateProjectTerminal.mockResolvedValue(terminalSession({ status: 'running' }));
    mockedKillProjectTerminal.mockResolvedValue(terminalSession({ status: 'exited', signal: 'SIGTERM' }));
    vi.stubGlobal('EventSource', FakeEventSource);

    render(<ProjectTerminalPanel projectId="project-1" />);

    await screen.findByText('/tmp/project-1');
    fireEvent.click(screen.getByRole('button', { name: 'Stop terminal' }));

    await waitFor(() => {
      expect(mockedKillProjectTerminal).toHaveBeenCalledWith('project-1', 'term-1');
    });
    expect(screen.getByText('Stopped SIGTERM')).toBeTruthy();
  });

  it('resizes the daemon terminal when the output viewport changes', async () => {
    mockedCreateProjectTerminal.mockResolvedValue(terminalSession({ cols: 80, rows: 24, status: 'running' }));
    mockedResizeProjectTerminal.mockResolvedValue(terminalSession({ cols: 120, rows: 20, updatedAt: 2 }));
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    render(<ProjectTerminalPanel projectId="project-1" />);

    await screen.findByText('/tmp/project-1');
    act(() => {
      FakeResizeObserver.instances[0]?.emit(960, 360);
    });

    await waitFor(() => {
      expect(mockedResizeProjectTerminal).toHaveBeenCalledWith('project-1', 'term-1', 120, 20);
    });
  });
});

function terminalSession(overrides: Partial<TerminalSession> = {}): TerminalSession {
  return {
    id: 'term-1',
    projectId: 'project-1',
    cwd: '/tmp/project-1',
    shell: '/bin/zsh',
    cols: 80,
    rows: 24,
    status: 'running',
    createdAt: 1,
    updatedAt: 1,
    exitCode: null,
    signal: null,
    ...overrides,
  };
}
