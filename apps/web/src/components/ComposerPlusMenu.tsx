import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  ConnectorDetail,
  InstalledPluginRecord,
} from '@open-design/contracts';
import { useT } from '../i18n';
import type { McpServerConfig } from '../state/mcp';
import { Icon } from './Icon';
import {
  ConnectorFlyout,
  McpFlyout,
  PluginFlyout,
} from './ComposerPlusMenuFlyouts';
import { PlusSubmenuRow } from './ComposerPlusMenuRow';
import {
  composerPlusFlyoutSide,
  composerPlusMenuStyle,
  type FlyoutSide,
} from './composer-plus-menu-geometry';

type SubmenuId = 'connectors' | 'plugins' | 'skills' | 'mcp' | 'import';

interface RenderSlotArgs {
  readonly close: () => void;
}

export interface ComposerPlusMenuProps {
  readonly connectors: readonly ConnectorDetail[];
  readonly onPickConnector: (connector: ConnectorDetail) => void;
  readonly onAddConnector?: () => void;
  readonly plugins: readonly InstalledPluginRecord[];
  readonly onPickPlugin: (plugin: InstalledPluginRecord) => void;
  readonly onAddPlugin?: () => void;
  readonly mcpServers: readonly McpServerConfig[];
  readonly onPickMcp: (server: McpServerConfig) => void;
  readonly onAddMcp?: () => void;
  readonly onAttachFiles: () => void;
  readonly attachLoading?: boolean;
  readonly renderPlugins?: (args: RenderSlotArgs) => ReactNode;
  readonly renderSkills?: (args: RenderSlotArgs) => ReactNode;
  readonly renderMcp?: (args: RenderSlotArgs) => ReactNode;
  readonly renderImport?: (args: RenderSlotArgs) => ReactNode;
  readonly triggerTestId?: string;
  readonly onOpen?: () => void;
}

export function ComposerPlusMenu({
  connectors,
  onPickConnector,
  onAddConnector,
  plugins,
  onPickPlugin,
  onAddPlugin,
  mcpServers,
  onPickMcp,
  onAddMcp,
  onAttachFiles,
  attachLoading = false,
  renderPlugins,
  renderSkills,
  renderMcp,
  renderImport,
  triggerTestId,
  onOpen,
}: ComposerPlusMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubmenuId | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [flyoutSide, setFlyoutSide] = useState<FlyoutSide>('right');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      setMenuStyle(composerPlusMenuStyle(trigger));
      setFlyoutSide(composerPlusFlyoutSide(trigger));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setSubmenu(null);
  }

  return (
    <div className="plus-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-btn plus-menu__trigger od-tooltip${open ? ' is-active' : ''}`}
        data-testid={triggerTestId}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          onOpen?.();
          setOpen(true);
        }}
        title="Add context"
        data-tooltip="Add context"
        aria-label="Add context"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="plus" size={16} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popupRef}
              className={`plus-menu__popup plus-menu__popup--flyout-${flyoutSide}`}
              role="menu"
              style={menuStyle ?? undefined}
            >
              <button
                type="button"
                role="menuitem"
                className="plus-menu__item"
                data-testid="composer-plus-attach"
                disabled={attachLoading}
                onClick={() => {
                  close();
                  onAttachFiles();
                }}
              >
                <Icon name={attachLoading ? 'spinner' : 'attach'} size={15} className="plus-menu__item-icon" />
                <span>{t('chat.attachAria')}</span>
              </button>
              <PlusSubmenuRow id="connectors" label={t('connectors.title')} icon="link" active={submenu} onOpen={setSubmenu}>
                <ConnectorFlyout connectors={connectors} onPick={onPickConnector} onAdd={onAddConnector} close={close} />
              </PlusSubmenuRow>
              <PlusSubmenuRow id="plugins" label={t('entry.navPlugins')} icon="sparkles" active={submenu} onOpen={setSubmenu}>
                {renderPlugins ? renderPlugins({ close }) : (
                  <PluginFlyout plugins={plugins} onPick={onPickPlugin} onAdd={onAddPlugin} close={close} />
                )}
              </PlusSubmenuRow>
              {renderSkills ? (
                <PlusSubmenuRow id="skills" label="Skills" icon="file" active={submenu} onOpen={setSubmenu}>
                  {renderSkills({ close })}
                </PlusSubmenuRow>
              ) : null}
              <PlusSubmenuRow id="mcp" label="MCP" icon="link" active={submenu} onOpen={setSubmenu}>
                {renderMcp ? renderMcp({ close }) : (
                  <McpFlyout servers={mcpServers} onPick={onPickMcp} onAdd={onAddMcp} close={close} />
                )}
              </PlusSubmenuRow>
              {renderImport ? (
                <PlusSubmenuRow id="import" label={t('chat.importLabel')} icon="import" active={submenu} onOpen={setSubmenu}>
                  {renderImport({ close })}
                </PlusSubmenuRow>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
