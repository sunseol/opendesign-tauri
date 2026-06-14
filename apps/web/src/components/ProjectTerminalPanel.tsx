import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TerminalSession } from '@open-design/contracts';
import {
  createProjectTerminal,
  killProjectTerminal,
  projectTerminalStreamUrl,
  resizeProjectTerminal,
  writeProjectTerminalInput,
} from '../providers/registry';
import { Icon } from './Icon';

type TerminalPhase = 'starting' | 'running' | 'exited' | 'error';
const TERMINAL_CELL_WIDTH_PX = 8;
const TERMINAL_ROW_HEIGHT_PX = 18;
const MIN_TERMINAL_COLS = 20;
const MAX_TERMINAL_COLS = 400;
const MIN_TERMINAL_ROWS = 5;
const MAX_TERMINAL_ROWS = 120;

export function ProjectTerminalPanel({ projectId }: { projectId: string }) {
  const [terminal, setTerminal] = useState<TerminalSession | null>(null);
  const [phase, setPhase] = useState<TerminalPhase>('starting');
  const [output, setOutput] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const outputRef = useRef<HTMLPreElement | null>(null);
  const lastResizeRef = useRef<{ cols: number; rows: number; terminalId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTerminal(null);
    setPhase('starting');
    setOutput('');
    setInput('');
    setError(null);
    sourceRef.current?.close();
    sourceRef.current = null;

    async function startTerminal(): Promise<void> {
      const nextTerminal = await createProjectTerminal(projectId);
      if (cancelled) return;
      if (!nextTerminal) {
        setPhase('error');
        setError('Terminal could not be started.');
        return;
      }
      setTerminal(nextTerminal);
      setPhase(nextTerminal.status === 'exited' ? 'exited' : 'running');
      if (nextTerminal.status === 'exited') return;
      if (typeof EventSource === 'undefined') {
        setError('Terminal streaming is unavailable in this browser.');
        return;
      }
      const source = new EventSource(projectTerminalStreamUrl(projectId, nextTerminal.id));
      sourceRef.current = source;
      source.addEventListener('data', (event) => {
        const chunk = terminalDataFromEvent(event);
        if (chunk === null) return;
        setOutput((current) => `${current}${chunk}`);
      });
      source.addEventListener('exit', (event) => {
        const exit = terminalExitFromEvent(event);
        if (exit) {
          setTerminal((current) =>
            current
              ? {
                  ...current,
                  status: 'exited',
                  exitCode: exit.code,
                  signal: exit.signal,
                }
              : current,
          );
        }
        setPhase('exited');
        source.close();
      });
      source.addEventListener('error', () => {
        if (cancelled) return;
        setError('Terminal stream disconnected.');
      });
    }

    void startTerminal();
    return () => {
      cancelled = true;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    const outputEl = outputRef.current;
    if (!outputEl) return;
    outputEl.scrollTop = outputEl.scrollHeight;
  }, [output]);

  useEffect(() => {
    const activeTerminal = terminal;
    const outputEl = outputRef.current;
    if (!activeTerminal || phase !== 'running' || typeof ResizeObserver === 'undefined' || !outputEl) return;
    let disposed = false;
    lastResizeRef.current = {
      cols: activeTerminal.cols,
      rows: activeTerminal.rows,
      terminalId: activeTerminal.id,
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextSize = terminalSizeFromRect(entry.contentRect.width, entry.contentRect.height);
      if (!nextSize) return;
      const lastSize = lastResizeRef.current;
      if (
        lastSize?.terminalId === activeTerminal.id &&
        lastSize.cols === nextSize.cols &&
        lastSize.rows === nextSize.rows
      ) {
        return;
      }
      lastResizeRef.current = { ...nextSize, terminalId: activeTerminal.id };
      resizeProjectTerminal(projectId, activeTerminal.id, nextSize.cols, nextSize.rows)
        .then((updated) => {
          if (!disposed && updated) setTerminal(updated);
        })
        .catch((err: unknown) => {
          if (disposed) return;
          if (err instanceof Error) {
            setError(err.message);
            return;
          }
          throw err;
        });
    });
    observer.observe(outputEl);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [phase, projectId, terminal]);

  async function sendInput(): Promise<void> {
    const activeTerminal = terminal;
    const value = input;
    if (!activeTerminal || phase !== 'running' || !value.trim() || sending) return;
    setSending(true);
    try {
      const data = value.endsWith('\n') ? value : `${value}\n`;
      const updated = await writeProjectTerminalInput(projectId, activeTerminal.id, data);
      if (updated) setTerminal(updated);
      setInput('');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function stopTerminal(): Promise<void> {
    const activeTerminal = terminal;
    if (!activeTerminal || phase !== 'running') return;
    try {
      const stopped = await killProjectTerminal(projectId, activeTerminal.id);
      if (stopped) {
        setTerminal(stopped);
        setPhase(stopped.status === 'exited' ? 'exited' : 'running');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      throw err;
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void sendInput();
  }

  const statusLabel = terminal ? terminalStatusLabel(terminal, phase) : phase === 'starting' ? 'Starting' : 'Unavailable';
  const sendDisabled = !terminal || phase !== 'running' || !input.trim() || sending;
  const stopDisabled = !terminal || phase !== 'running';

  return (
    <section className="project-terminal-panel" aria-label="Project terminal">
      <header className="project-terminal-header">
        <div className="project-terminal-title">
          <Icon name="file-code" size={14} />
          <span>Terminal</span>
          <strong>{statusLabel}</strong>
        </div>
        <button
          type="button"
          className="ghost compact"
          onClick={() => void stopTerminal()}
          disabled={stopDisabled}
        >
          <Icon name="stop" size={13} />
          Stop terminal
        </button>
      </header>
      <div className="project-terminal-meta">
        {terminal ? (
          <>
            <span>{terminal.cwd}</span>
            <span>{terminal.shell}</span>
          </>
        ) : (
          <span>Preparing project shell...</span>
        )}
      </div>
      <pre ref={outputRef} className="project-terminal-output" aria-label="Terminal output">
        {output || (phase === 'starting' ? 'Starting terminal...\n' : '')}
      </pre>
      {error ? <p className="project-terminal-error">{error}</p> : null}
      <div className="project-terminal-input-row">
        <textarea
          aria-label="Terminal input"
          value={input}
          rows={2}
          disabled={phase !== 'running'}
          placeholder="Type a command"
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
        />
        <button
          type="button"
          className="primary"
          onClick={() => void sendInput()}
          disabled={sendDisabled}
        >
          <Icon name="send" size={13} />
          Send command
        </button>
      </div>
    </section>
  );
}

function terminalStatusLabel(terminal: TerminalSession, phase: TerminalPhase): string {
  if (phase === 'running' && terminal.status === 'running') return 'Running';
  if (terminal.signal) return `Stopped ${terminal.signal}`;
  if (terminal.exitCode !== null) return `Exited ${terminal.exitCode}`;
  if (terminal.status === 'exited') return 'Exited';
  return phase === 'starting' ? 'Starting' : 'Running';
}

function terminalSizeFromRect(width: number, height: number): { cols: number; rows: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    cols: clampInteger(Math.floor(width / TERMINAL_CELL_WIDTH_PX), MIN_TERMINAL_COLS, MAX_TERMINAL_COLS),
    rows: clampInteger(Math.floor(height / TERMINAL_ROW_HEIGHT_PX), MIN_TERMINAL_ROWS, MAX_TERMINAL_ROWS),
  };
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function terminalDataFromEvent(event: Event): string | null {
  const payload = parseMessageEventPayload(event);
  if (!isObjectRecord(payload)) return null;
  return typeof payload.data === 'string' ? payload.data : null;
}

function terminalExitFromEvent(event: Event): { code: number | null; signal: string | null } | null {
  const payload = parseMessageEventPayload(event);
  if (!isObjectRecord(payload)) return null;
  const code = typeof payload.code === 'number' ? payload.code : null;
  const signal = typeof payload.signal === 'string' ? payload.signal : null;
  return { code, signal };
}

function parseMessageEventPayload(event: Event): unknown {
  if (!(event instanceof MessageEvent)) return null;
  try {
    return JSON.parse(event.data);
  } catch (err) {
    if (err instanceof Error) return null;
    throw err;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
