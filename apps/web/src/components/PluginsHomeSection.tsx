// Plugins discovery section on Home.
//
// Renders an artifact-kind bar over the plugin catalog: Prototype ·
// Slides · Image · Video · HyperFrames · Audio. Prototype, Slides,
// Image, and Video can reveal scene buckets from the user-prompt
// taxonomy; HyperFrames and Audio stay flat. A small Saved chip
// sits orthogonal to the rows for quick access to user-saved picks.
//
// The category list is curated — finer metadata (surface, role tags,
// scenario domains) lives on each plugin card and detail surface.
//
// Derivation, catalog building and category-based filtering live in
// `./plugins-home/facets.ts`; selection state and the Saved
// override live in `./plugins-home/usePluginFacets.ts`. This file
// owns layout only.

import { useState } from 'react';
import type { InstalledPluginRecord } from '@open-design/contracts';
import { useT } from '../i18n';
import type { PluginShareAction } from '../state/projects';
import { PluginCard } from './plugins-home/PluginCard';
import { CategoryRow, SubcategoryRow } from './plugins-home/FacetRows';
import { isFeaturedPlugin, type FacetSelection } from './plugins-home/facets';
import { usePluginFacets } from './plugins-home/usePluginFacets';
import { useSavedPluginIds } from './plugins-home/savedPlugins';
import type { PluginUseAction } from './plugins-home/useActions';
import { Toast } from './Toast';

interface Props {
  plugins: InstalledPluginRecord[];
  loading: boolean;
  activePluginId: string | null;
  pendingApplyId: string | null;
  pendingShareAction?: { pluginId: string; action: PluginShareAction } | null;
  onUse: (record: InstalledPluginRecord, action: PluginUseAction) => void;
  onOpenDetails: (record: InstalledPluginRecord) => void;
  onPluginShareAction?: (
    record: InstalledPluginRecord,
    action: PluginShareAction,
  ) => void;
  onBrowseRegistry?: () => void;
  preferDefaultFacet?: boolean;
  // Optional external selection. When the Home chip rail picks
  // "Slide deck", HomeView passes { category: 'deck', subcategory:
  // null } so the Community grid scrolls to the matching
  // slice instead of staying on its default. The hook only re-applies
  // when this identity changes, so manual facet clicks still win.
  presetSelection?: FacetSelection | null;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}

export function PluginsHomeSection({
  plugins,
  loading,
  activePluginId,
  pendingApplyId,
  pendingShareAction = null,
  onUse,
  onOpenDetails,
  onPluginShareAction,
  onBrowseRegistry,
  preferDefaultFacet = true,
  presetSelection = null,
  title,
  subtitle,
  emptyMessage,
}: Props) {
  const t = useT();
  const { savedPluginIds, savePluginId } = useSavedPluginIds();
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const {
    visiblePlugins,
    savedList,
    filtered,
    catalog,
    selection,
    pickCategory,
    pickSubcategory,
    clearFacets,
    mode,
    setMode,
    query,
    setQuery,
    sortOrder,
    setSortOrder,
    totalVisible,
  } = usePluginFacets({
    plugins,
    savedPluginIds,
    preferDefaultFacet,
    presetSelection,
  });

  function handleSavePlugin(record: InstalledPluginRecord): void {
    const result = savePluginId(record.id);
    if (result === 'saved') {
      setSaveToast(`Saved ${record.title}.`);
    } else if (result === 'already-saved') {
      setSaveToast(`${record.title} is already saved.`);
    } else {
      setSaveToast('Could not save this plugin in this browser.');
    }
  }

  return (
    <section className="plugins-home" data-testid="plugins-home-section">
      <header className="plugins-home__head">
        <div className="plugins-home__heading">
          <h2 className="plugins-home__title">{title ?? t('pluginsHome.title')}</h2>
          {subtitle ? (
            <p className="plugins-home__subtitle">{subtitle}</p>
          ) : null}
        </div>
        <div className="plugins-home__head-tools">
          {onBrowseRegistry ? (
            <button
              type="button"
              className="plugins-home__linkbtn"
              onClick={onBrowseRegistry}
              data-testid="plugins-home-browse-registry"
            >
              {t('pluginsHome.browseRegistry')}
            </button>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="plugins-home__empty">{t('pluginsHome.loadingCatalog')}</div>
      ) : visiblePlugins.length === 0 ? (
        <div className="plugins-home__empty">
          {emptyMessage ?? t('pluginsHome.emptyCatalog')}
        </div>
      ) : (
        <>
          <div
            className="plugins-home__facets"
            role="group"
            aria-label="Plugin filters"
          >
            <CategoryRow
              options={catalog.category}
              selectedSlug={selection.category}
              totalVisible={totalVisible}
              onPick={pickCategory}
              savedCount={savedList.length}
              savedActive={mode === 'saved'}
              onToggleSaved={() =>
                setMode(mode === 'saved' ? 'all' : 'saved')
              }
              query={query}
              onQueryChange={setQuery}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
            {selection.category ? (
              <SubcategoryRow
                parent={catalog.category.find((opt) => opt.slug === selection.category)}
                options={catalog.subcategory[selection.category] ?? []}
                selectedSlug={selection.subcategory}
                onPick={pickSubcategory}
              />
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="plugins-home__empty plugins-home__empty--filtered">
              {t('pluginsHome.emptyFiltered')}{' '}
              <button
                type="button"
                className="plugins-home__linkbtn"
                onClick={clearFacets}
              >
                {t('pluginsHome.clearFilters')}
              </button>
            </div>
          ) : (
            <div className="plugins-home__grid" role="list">
              {filtered.map((p) => (
                <PluginCard
                  key={p.id}
                  record={p}
                  isActive={activePluginId === p.id}
                  isPending={pendingApplyId === p.id}
                  pendingAny={pendingApplyId !== null}
                  pendingShareAction={pendingShareAction}
                  isFeatured={isFeaturedPlugin(p)}
                  isSaved={savedPluginIds.has(p.id)}
                  onUse={onUse}
                  onOpenDetails={onOpenDetails}
                  onSave={handleSavePlugin}
                  onShareAction={onPluginShareAction}
                />
              ))}
            </div>
          )}
        </>
      )}
      {saveToast ? (
        <Toast
          message={saveToast}
          ttlMs={2200}
          onDismiss={() => setSaveToast(null)}
        />
      ) : null}
    </section>
  );
}
