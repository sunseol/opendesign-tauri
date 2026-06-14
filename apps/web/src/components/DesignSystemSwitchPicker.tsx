import { useEffect, useMemo, useState } from 'react';

import type { Dict } from '../i18n/types';
import { fetchDesignSystems } from '../providers/registry';
import type { DesignSystemSummary } from '../types';
import { Icon } from './Icon';

type TranslateFn = (key: keyof Dict, vars?: Record<string, string | number>) => string;

type Props = {
  readonly currentDesignSystemId?: string | null;
  readonly onBack: () => void;
  readonly onSwitched?: () => void;
  readonly onSwitchDesignSystem: (designSystemId: string | null, title: string) => Promise<boolean>;
  readonly t: TranslateFn;
};

export function DesignSystemSwitchPicker({
  currentDesignSystemId = null,
  onBack,
  onSwitched,
  onSwitchDesignSystem,
  t,
}: Props) {
  const [items, setItems] = useState<readonly DesignSystemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const systems = await fetchDesignSystems();
      if (cancelled) return;
      setItems(systems);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.id, item.title, item.category ?? '', item.summary ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  async function choose(designSystemId: string | null, title: string): Promise<void> {
    if (busyId) return;
    if ((currentDesignSystemId ?? null) === designSystemId) {
      if (onSwitched) onSwitched();
      else onBack();
      return;
    }
    setBusyId(designSystemId ?? 'none');
    const switched = await onSwitchDesignSystem(designSystemId, title);
    setBusyId(null);
    if (switched) {
      if (onSwitched) onSwitched();
      else onBack();
    }
  }

  return (
    <div className="composer-ds-picker" data-testid="composer-ds-picker">
      <div className="composer-ds-picker-head">
        <button
          type="button"
          className="composer-ds-picker-back"
          onClick={onBack}
          aria-label={t('designFiles.back')}
        >
          <Icon name="arrow-left" size={14} />
        </button>
        <input
          className="ds-picker-search"
          data-testid="composer-ds-picker-search"
          type="search"
          value={query}
          placeholder={t('designSystemPicker.searchCompactPlaceholder')}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>
      <div className="ds-picker-list ds-picker-list-design-systems" role="listbox">
        <DesignSystemOption
          active={currentDesignSystemId == null}
          busyLabel={t('common.loading')}
          busy={busyId === 'none'}
          subtitle={t('designSystemPicker.noneSummary')}
          title={t('designSystemPicker.noneTitle')}
          testId="composer-ds-picker-item-none"
          onPick={() => void choose(null, t('designSystemPicker.noneTitle'))}
        />
        {loading ? <div className="ds-picker-empty">{t('common.loading')}</div> : null}
        {!loading && filtered.length === 0 ? (
          <div className="ds-picker-empty">{t('ds.emptyNoMatch')}</div>
        ) : null}
        {filtered.map((item) => (
          <DesignSystemOption
            key={item.id}
            active={item.id === currentDesignSystemId}
            busyLabel={t('common.loading')}
            busy={busyId === item.id}
            subtitle={item.summary ?? item.category ?? item.id}
            title={item.title}
            testId={`composer-ds-picker-item-${item.id}`}
            onPick={() => void choose(item.id, item.title)}
          />
        ))}
      </div>
    </div>
  );
}

function DesignSystemOption({
  active,
  busy,
  busyLabel,
  onPick,
  subtitle,
  testId,
  title,
}: {
  readonly active: boolean;
  readonly busy: boolean;
  readonly busyLabel: string;
  readonly onPick: () => void;
  readonly subtitle: string;
  readonly testId: string;
  readonly title: string;
}) {
  return (
    <button
      type="button"
      className={`ds-picker-item${active ? ' active' : ''}`}
      data-testid={testId}
      role="option"
      aria-selected={active}
      disabled={busy}
      onClick={onPick}
    >
      <span className={`ds-picker-mark check${active ? ' active' : ''}`} aria-hidden>
        {active ? <Icon name="check" size={12} /> : null}
      </span>
      <span className="ds-picker-item-text">
        <span className="ds-picker-item-title">{title}</span>
        <span className="ds-picker-item-sub">{busy ? busyLabel : subtitle}</span>
      </span>
    </button>
  );
}
