import { useMemo, useState } from 'react';
import type {
  ConnectorDetail,
  InstalledPluginRecord,
} from '@open-design/contracts';
import { useI18n } from '../i18n';
import type { McpServerConfig } from '../state/mcp';
import { localizePluginTitle } from './plugins-home/localization';
import { Icon } from './Icon';

interface Closeable {
  readonly close: () => void;
}

export function ConnectorFlyout({
  connectors,
  onPick,
  onAdd,
  close,
}: Closeable & {
  readonly connectors: readonly ConnectorDetail[];
  readonly onPick: (connector: ConnectorDetail) => void;
  readonly onAdd?: () => void;
}) {
  return (
    <>
      <div className="plus-menu__list">
        {connectors.length === 0 ? (
          <div className="plus-menu__empty">No connected connectors yet.</div>
        ) : (
          connectors.map((connector) => (
            <button
              key={connector.id}
              type="button"
              role="menuitem"
              className="plus-menu__item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                close();
                onPick(connector);
              }}
            >
              <Icon name="link" size={15} className="plus-menu__item-icon" />
              <span>{connector.name}</span>
            </button>
          ))
        )}
      </div>
      {onAdd ? <AddRow label="Add connector" onAdd={onAdd} close={close} /> : null}
    </>
  );
}

export function PluginFlyout({
  plugins,
  onPick,
  onAdd,
  close,
}: Closeable & {
  readonly plugins: readonly InstalledPluginRecord[];
  readonly onPick: (plugin: InstalledPluginRecord) => void;
  readonly onAdd?: () => void;
}) {
  const { locale } = useI18n();
  const [query, setQuery] = useState('');
  const visiblePlugins = useMemo(
    () => plugins.filter((plugin) => pluginMatches(plugin, query, localizePluginTitle(locale, plugin))),
    [locale, plugins, query],
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label="Plugins" />
      <div className="plus-menu__list">
        {visiblePlugins.length === 0 ? (
          <div className="plus-menu__empty">No plugins found.</div>
        ) : (
          visiblePlugins.map((plugin) => (
            <button
              key={plugin.id}
              type="button"
              role="menuitem"
              className="plus-menu__item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                close();
                onPick(plugin);
              }}
              title={plugin.manifest?.description ?? plugin.title}
            >
              <Icon name="sparkles" size={15} className="plus-menu__item-icon" />
              <span>{localizePluginTitle(locale, plugin)}</span>
            </button>
          ))
        )}
      </div>
      {onAdd ? <AddRow label="Add plugin" onAdd={onAdd} close={close} /> : null}
    </>
  );
}

export function McpFlyout({
  servers,
  onPick,
  onAdd,
  close,
}: Closeable & {
  readonly servers: readonly McpServerConfig[];
  readonly onPick: (server: McpServerConfig) => void;
  readonly onAdd?: () => void;
}) {
  const [query, setQuery] = useState('');
  const visibleServers = useMemo(
    () => servers.filter((server) => mcpMatches(server, query)),
    [servers, query],
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label="MCP" />
      <div className="plus-menu__list">
        {visibleServers.length === 0 ? (
          <div className="plus-menu__empty">No enabled MCP servers yet.</div>
        ) : (
          visibleServers.map((server) => (
            <button
              key={server.id}
              type="button"
              role="menuitem"
              className="plus-menu__item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                close();
                onPick(server);
              }}
            >
              <Icon name="link" size={15} className="plus-menu__item-icon" />
              <span>{server.label || server.id}</span>
            </button>
          ))
        )}
      </div>
      {onAdd ? <AddRow label="Manage MCP servers" onAdd={onAdd} close={close} /> : null}
    </>
  );
}

function AddRow({ label, onAdd, close }: Closeable & { readonly label: string; readonly onAdd: () => void }) {
  return (
    <>
      <div className="plus-menu__divider" />
      <button
        type="button"
        role="menuitem"
        className="plus-menu__item"
        onClick={() => {
          close();
          onAdd();
        }}
      >
        <Icon name="plus" size={15} className="plus-menu__item-icon" />
        <span>{label}</span>
      </button>
    </>
  );
}

function SearchBox({ value, onChange, label }: { readonly value: string; readonly onChange: (value: string) => void; readonly label: string }) {
  return (
    <div className="plus-menu__search">
      <Icon name="search" size={13} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} aria-label={label} />
    </div>
  );
}

function pluginMatches(plugin: InstalledPluginRecord, query: string, localizedTitle: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [localizedTitle, plugin.title, plugin.id, plugin.manifest?.description ?? '', ...(plugin.manifest?.tags ?? [])].join(' ').toLowerCase().includes(needle);
}

function mcpMatches(server: McpServerConfig, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [server.label ?? '', server.id, server.transport, server.command ?? '', server.url ?? ''].join(' ').toLowerCase().includes(needle);
}
