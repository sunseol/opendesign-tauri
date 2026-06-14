import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Icon } from './Icon';

interface Props {
  readonly workingDir: string | null;
  readonly recentDirs: readonly string[];
  readonly onPickDirectory: () => void;
  readonly onSelectRecent: (dir: string) => void;
  readonly onClear?: () => void;
}

function folderName(dir: string): string {
  return dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;
}

export function WorkingDirPicker({
  workingDir,
  recentDirs,
  onPickDirectory,
  onSelectRecent,
  onClear,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setRecentOpen(false);
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="home-working-dir" data-testid="working-dir-picker" ref={wrapRef}>
      <button
        type="button"
        className="home-working-dir__trigger"
        data-testid="working-dir-trigger"
        aria-expanded={open}
        title={workingDir ?? t('workingDirPicker.homeTitle')}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="folder" size={13} />
        <span>{workingDir ? folderName(workingDir) : t('workingDirPicker.select')}</span>
        <Icon name="chevron-down" size={11} />
      </button>
      {open ? (
        <div className="home-working-dir__panel" role="menu" data-testid="working-dir-panel">
          <button
            type="button"
            role="menuitem"
            className="home-working-dir__item"
            data-testid="working-dir-pick"
            onClick={() => {
              setOpen(false);
              onPickDirectory();
            }}
          >
            <Icon name="folder" size={14} />
            <span>{workingDir ? t('workingDirPicker.replace') : t('workingDirPicker.select')}</span>
          </button>
          <div
            className="home-working-dir__submenu"
            onMouseEnter={() => {
              if (recentDirs.length > 0) setRecentOpen(true);
            }}
            onMouseLeave={() => setRecentOpen(false)}
          >
            <button
              type="button"
              role="menuitem"
              className="home-working-dir__item"
              data-testid="working-dir-recent"
              aria-haspopup="menu"
              aria-expanded={recentOpen}
              disabled={recentDirs.length === 0}
              onClick={() => {
                if (recentDirs.length === 0) return;
                setRecentOpen((value) => !value);
              }}
            >
              <Icon name="history" size={14} />
              <span>{t('workingDirPicker.recent')}</span>
              <Icon name="chevron-right" size={12} />
            </button>
            {recentOpen && recentDirs.length > 0 ? (
              <div
                className="home-working-dir__flyout"
                role="menu"
                data-testid="working-dir-recent-list"
              >
                {recentDirs.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    role="menuitem"
                    className="home-working-dir__recent-item"
                    title={dir}
                    onClick={() => {
                      onSelectRecent(dir);
                      setOpen(false);
                    }}
                  >
                    <Icon name="folder" size={13} />
                    <span className="home-working-dir__recent-name">{folderName(dir)}</span>
                    <span className="home-working-dir__recent-path">{dir}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {workingDir && onClear ? (
            <button
              type="button"
              role="menuitem"
              className="home-working-dir__item"
              data-testid="working-dir-clear"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <Icon name="close" size={14} />
              <span>{t('workingDirPicker.clearAria')}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
