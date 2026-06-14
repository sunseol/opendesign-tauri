import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnalytics } from '../analytics/provider';
import {
  trackDesignSystemsTemplateCardClick,
  trackDesignSystemsTopClick,
  trackPageView,
} from '../analytics/events';
import { useI18n } from '../i18n';
import {
  localizeDesignSystemCategory,
  localizeDesignSystemSummary,
} from '../i18n/content';
import { fetchDesignSystemShowcase } from '../providers/registry';
import { buildSrcdoc } from '../runtime/srcdoc';
import {
  DesignSystemsUserSettings,
  isUserSystem,
} from './DesignSystemsUserSettings';
import type { DesignSystemSummary, ProjectTemplate, Surface } from '../types';

interface Props {
  systems: DesignSystemSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
  onCreate?: () => void;
  onOpenSystem?: (id: string) => void;
  onSystemsRefresh?: () => Promise<void> | void;
  templates?: ProjectTemplate[];
}

const CATEGORY_ORDER = [
  'Starter',
  'AI & LLM',
  'Developer Tools',
  'Productivity & SaaS',
  'Backend & Data',
  'Design & Creative',
  'Fintech & Crypto',
  'E-Commerce & Retail',
  'Media & Consumer',
  'Automotive',
];

type SurfaceFilter = 'all' | Surface;

const SURFACE_PILLS: { value: SurfaceFilter; labelKey: 'examples.modeAll' | 'ds.surfaceWeb' | 'ds.surfaceImage' | 'ds.surfaceVideo' | 'ds.surfaceAudio' }[] = [
  { value: 'all', labelKey: 'examples.modeAll' },
  { value: 'web', labelKey: 'ds.surfaceWeb' },
  { value: 'image', labelKey: 'ds.surfaceImage' },
  { value: 'video', labelKey: 'ds.surfaceVideo' },
  { value: 'audio', labelKey: 'ds.surfaceAudio' },
];

function surfaceOf(system: DesignSystemSummary): Surface {
  return system.surface ?? 'web';
}

export function DesignSystemsTab({
  systems,
  selectedId,
  onSelect,
  onPreview,
  onCreate,
  onOpenSystem,
  onSystemsRefresh,
}: Props) {
  const { locale, t } = useI18n();
  const analytics = useAnalytics();
  const designSystemsPageViewFiredRef = useRef(false);
  useEffect(() => {
    if (designSystemsPageViewFiredRef.current) return;
    designSystemsPageViewFiredRef.current = true;
    // v2 doc: the DS list page also carries `area` / `view_type` /
    // `entry_from` so it can stitch the cross-surface DS funnel.
    // `entry_from` is `unknown` here because the tab is reached
    // through the home nav rail; a router-aware entry mapper can
    // refine this later.
    trackPageView(analytics.track, {
      page_name: 'design_systems',
      area: 'design_system_list',
      view_type: 'page',
      entry_from: 'unknown',
      available_design_system_count: systems.length,
    });
  }, [analytics.track, systems.length]);
  const searchTrackedRef = useRef(false);
  const categoryTrackedRef = useRef(false);
  const [filter, setFilter] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<SurfaceFilter>('all');
  const [category, setCategory] = useState<string>('All');
  // Cache fetched showcase HTML across re-renders so cards never re-flicker
  // when the user filters / scrolls back. null = "in flight"; undefined =
  // "not yet requested". Mirrors the pattern used by ExamplesTab.
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});

  const librarySystems = useMemo(
    () => systems.filter((system) => !isUserSystem(system)),
    [systems],
  );

  const surfaceScoped = useMemo(
    () => surfaceFilter === 'all'
      ? librarySystems
      : librarySystems.filter((s) => surfaceOf(s) === surfaceFilter),
    [librarySystems, surfaceFilter],
  );

  // Total systems per surface, ignoring every active filter. Drives the
  // "this surface is now empty" fallback below — that guard must react to
  // the catalog itself, not to a transient style/search filter.
  const surfaceTotals = useMemo(() => {
    const counts: Record<SurfaceFilter, number> = { all: librarySystems.length, web: 0, image: 0, video: 0, audio: 0 };
    for (const s of librarySystems) counts[surfaceOf(s)]++;
    return counts;
  }, [librarySystems]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of surfaceScoped) cats.add(s.category || 'Uncategorized');
    const ordered: string[] = [];
    for (const c of CATEGORY_ORDER) if (cats.has(c)) ordered.push(c);
    for (const c of [...cats].sort()) if (!ordered.includes(c)) ordered.push(c);
    return ['All', ...ordered];
  }, [surfaceScoped]);

  // Keep surfaceFilter and category in sync when systems changes dynamically.
  // If the currently selected surface has zero items, fall back to 'all'.
  // If the current category is no longer present in the filtered list, fall back to 'All'.
  useEffect(() => {
    if (surfaceFilter !== 'all' && surfaceTotals[surfaceFilter] === 0) {
      setSurfaceFilter('all');
      setCategory('All');
    } else if (category !== 'All' && !categories.includes(category)) {
      setCategory('All');
    }
  }, [systems, surfaceFilter, surfaceTotals, category, categories]);

  // Systems matching the active style category and search text, before the
  // surface filter is applied. Both the surface pill counts and the visible
  // grid derive from this so a surface chip always reports its own result
  // set rather than the unfiltered catalog total.
  const queryScoped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return librarySystems.filter((s) => {
      if (category !== 'All' && (s.category || 'Uncategorized') !== category) return false;
      if (!q) return true;
      const summary = localizeDesignSystemSummary(locale, s).toLowerCase();
      const categoryLabel = localizeDesignSystemCategory(
        locale,
        s.category || 'Uncategorized',
      ).toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        summary.includes(q) ||
        categoryLabel.includes(q)
      );
    });
  }, [librarySystems, filter, category, locale]);

  const surfaceCounts = useMemo(() => {
    const counts: Record<SurfaceFilter, number> = {
      all: queryScoped.length, web: 0, image: 0, video: 0, audio: 0,
    };
    for (const s of queryScoped) counts[surfaceOf(s)]++;
    return counts;
  }, [queryScoped]);

  const filtered = useMemo(
    () => surfaceFilter === 'all'
      ? queryScoped
      : queryScoped.filter((s) => surfaceOf(s) === surfaceFilter),
    [queryScoped, surfaceFilter],
  );

  // Category metadata is authored in English; keep raw values in state for
  // filtering while localizing the visible labels for the current UI locale.
  const renderCategory = (c: string) => {
    if (c === 'All') return t('ds.categoryAll');
    if (c === 'Uncategorized') return t('ds.categoryUncategorized');
    return localizeDesignSystemCategory(locale, c);
  };

  function loadThumb(id: string) {
    setThumbs((prev) => {
      if (prev[id] !== undefined) return prev;
      void fetchDesignSystemShowcase(id).then((html) => {
        setThumbs((p) => ({ ...p, [id]: html }));
      });
      return { ...prev, [id]: null };
    });
  }

  return (
    <div className="tab-panel design-systems-manager" data-testid="design-systems-tab">
      <DesignSystemsUserSettings
        systems={systems}
        selectedId={selectedId}
        onSelect={onSelect}
        onCreate={onCreate}
        onOpenSystem={onOpenSystem}
        onSystemsRefresh={onSystemsRefresh}
      />

      <section className="ds-settings-card" aria-label="Built-in design systems">
        <div className="ds-settings-card__head">
          <div>
            <span className="ds-manager-eyebrow">Library</span>
            <h2>Built-in library</h2>
          </div>
        </div>
        <div className="tab-panel-toolbar ds-manager-toolbar">
          <input
            data-testid="design-systems-search"
            placeholder={t('ds.searchPlaceholder')}
            value={filter}
            onFocus={() => {
              if (searchTrackedRef.current) return;
              searchTrackedRef.current = true;
              trackDesignSystemsTopClick(analytics.track, {
                page_name: 'design_systems',
                area: 'design_systems',
                element: 'search_input',
              });
            }}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            data-testid="design-systems-category-select"
            value={category}
            onFocus={() => {
              if (categoryTrackedRef.current) return;
              categoryTrackedRef.current = true;
              trackDesignSystemsTopClick(analytics.track, {
                page_name: 'design_systems',
                area: 'design_systems',
                element: 'search_dropdown',
              });
            }}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {renderCategory(c)}
              </option>
            ))}
          </select>
        </div>
        <div
          className="examples-filter-row"
          role="tablist"
          aria-label={t('ds.surfaceLabel')}
        >
          <span className="examples-filter-label">{t('ds.surfaceLabel')}</span>
          {/* Hide chips with no items in the active style/search filter, but
              always keep "all" and the currently selected surface — otherwise a
              transient search could remove the active chip and leave the grid
              filtered with no chip showing aria-selected. */}
          {SURFACE_PILLS.filter(
            (p) => p.value === surfaceFilter || p.value === 'all' || surfaceCounts[p.value] > 0,
          ).map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={surfaceFilter === p.value}
              data-testid={`design-systems-surface-${p.value}`}
              className={`filter-pill ${surfaceFilter === p.value ? 'active' : ''}`}
              onClick={() => {
                trackDesignSystemsTopClick(analytics.track, {
                  page_name: 'design_systems',
                  area: 'design_systems',
                  element: 'filter_chip',
                  filter_name: p.value,
                });
                setSurfaceFilter(p.value);
              }}
            >
              {t(p.labelKey)}
              <span className="filter-pill-count">{surfaceCounts[p.value]}</span>
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="tab-empty" data-testid="design-systems-empty">{t('ds.emptyNoMatch')}</div>
        ) : (
          <div className="ds-grid" data-testid="design-systems-grid">
            {filtered.map((s) => (
              <DesignSystemCard
                key={s.id}
                system={s}
                active={s.id === selectedId}
                thumbHtml={thumbs[s.id]}
                onIntersect={() => loadThumb(s.id)}
                onSelect={() => {
                  trackDesignSystemsTemplateCardClick(analytics.track, {
                    page_name: 'design_systems',
                    area: 'templates_card',
                    element: 'templates_card',
                    templates_id: s.id,
                    templates_type: s.source ?? 'library',
                  });
                  onSelect(s.id);
                }}
                onPreview={() => {
                  trackDesignSystemsTemplateCardClick(analytics.track, {
                    page_name: 'design_systems',
                    area: 'templates_card',
                    element: 'templates_card',
                    templates_id: s.id,
                    templates_type: s.source ?? 'library',
                  });
                  onPreview(s.id);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface CardProps {
  system: DesignSystemSummary;
  active: boolean;
  thumbHtml: string | null | undefined;
  onIntersect: () => void;
  onSelect: () => void;
  onPreview: () => void;
}

function DesignSystemCard({
  system,
  active,
  thumbHtml,
  onIntersect,
  onSelect,
  onPreview,
}: CardProps) {
  const { locale, t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);

  // Lazy-load the showcase iframe only when the card scrolls into the
  // viewport. With ~120 design systems we can't afford to mount every
  // iframe up front — even with `loading="lazy"`, srcDoc iframes ignore
  // the native lazy hint, so we gate via IntersectionObserver.
  useEffect(() => {
    if (thumbHtml !== undefined) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      onIntersect();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onIntersect();
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [thumbHtml, onIntersect]);

  const localizedSummary = localizeDesignSystemSummary(locale, system);
  const categoryLabel = localizeDesignSystemCategory(
    locale,
    system.category || 'Uncategorized',
  );

  return (
    <div
      ref={ref}
      className={`ds-card ${active ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      data-testid={`design-system-card-${system.id}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div
      className="ds-card-thumb"
      data-testid={`design-system-preview-${system.id}`}
      onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        title={t('ds.previewTitle')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onPreview();
          }
        }}
      >
        {thumbHtml ? (
          <iframe
            title={`${system.title} preview`}
            sandbox="allow-scripts"
            srcDoc={buildSrcdoc(thumbHtml)}
            tabIndex={-1}
            aria-hidden
          />
        ) : (
          <div className="ds-card-thumb-fallback" aria-hidden>
            {system.swatches && system.swatches.length > 0 ? (
              <div className="ds-card-thumb-swatches">
                {system.swatches.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
            ) : (
              <span className="ds-card-thumb-placeholder">
                {thumbHtml === null ? '' : ''}
              </span>
            )}
          </div>
        )}
        <span className="ds-card-thumb-overlay" aria-hidden>
          {t('ds.preview')}
        </span>
      </div>
      <div className="ds-card-meta" data-testid={`design-system-select-${system.id}`}>
        <div className="ds-card-title-row">
          <span className="ds-card-title">{system.title}</span>
          {active ? (
            <span className="ds-card-badge">{t('ds.badgeDefault')}</span>
          ) : null}
        </div>
        <div className="ds-card-summary">{localizedSummary}</div>
        <div className="ds-card-footer">
          <span className="ds-card-category">{categoryLabel}</span>
          {system.swatches && system.swatches.length > 0 ? (
            <div className="ds-card-swatches" aria-hidden>
              {system.swatches.map((c, i) => (
                <span key={i} style={{ background: c }} title={c} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
