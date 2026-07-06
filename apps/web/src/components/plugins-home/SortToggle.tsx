import { type KeyboardEvent, useRef } from 'react';
import { useT } from '../../i18n';
import type { PluginSortOrder } from './sortOrder';

interface SortToggleProps {
  value: PluginSortOrder;
  onChange: (next: PluginSortOrder) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  const t = useT();
  const segmentRefs = useRef<Record<PluginSortOrder, HTMLButtonElement | null>>({
    hot: null,
    newest: null,
  });
  const segments: Array<{ order: PluginSortOrder; label: string }> = [
    { order: 'hot', label: t('pluginsHome.sortHot') },
    { order: 'newest', label: t('pluginsHome.sortNewest') },
  ];
  function selectAndFocus(next: PluginSortOrder): void {
    onChange(next);
    segmentRefs.current[next]?.focus();
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Home') {
      event.preventDefault();
      selectAndFocus('hot');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      selectAndFocus('newest');
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectAndFocus(value === 'newest' ? 'hot' : 'newest');
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectAndFocus(value === 'hot' ? 'newest' : 'hot');
    }
  }
  return (
    <div
      className="plugins-home__sort"
      role="radiogroup"
      aria-label={t('pluginsHome.sortAria')}
      onKeyDown={handleKeyDown}
      data-testid="plugins-home-sort"
    >
      {segments.map((segment) => (
        <button
          key={segment.order}
          ref={(node) => {
            segmentRefs.current[segment.order] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === segment.order}
          tabIndex={value === segment.order ? 0 : -1}
          className={`plugins-home__sort-segment${value === segment.order ? ' is-active' : ''}`}
          onClick={() => onChange(segment.order)}
          data-testid={`plugins-home-sort-${segment.order}`}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
