import { useT } from '../../i18n';
import { Icon } from '../Icon';
import type { FacetOption } from './facets';
import { SortToggle } from './SortToggle';
import type { PluginSortOrder } from './sortOrder';
import { pluginSubfacetLabel } from './subfacetLabel';

interface CategoryRowProps {
  options: FacetOption[];
  selectedSlug: string | null;
  totalVisible: number;
  onPick: (slug: string | null) => void;
  savedCount: number;
  savedActive: boolean;
  onToggleSaved: () => void;
  query: string;
  onQueryChange: (next: string) => void;
  sortOrder: PluginSortOrder;
  onSortOrderChange: (next: PluginSortOrder) => void;
}

export function CategoryRow({
  options,
  selectedSlug,
  totalVisible,
  onPick,
  savedCount,
  savedActive,
  onToggleSaved,
  query,
  onQueryChange,
  sortOrder,
  onSortOrderChange,
}: CategoryRowProps) {
  const t = useT();
  if (options.length === 0) return null;
  return (
    <div
      className="plugins-home__facet-row plugins-home__facet-row--inline"
      data-testid="plugins-home-row-category"
    >
      <div
        className="plugins-home__facet-pills"
        role="tablist"
        aria-label={t('pluginsHome.categoryFilterAria')}
      >
        <button
          type="button"
          className={[
            'plugins-home__chip',
            'plugins-home__chip--saved',
            savedActive ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onToggleSaved}
          aria-pressed={savedActive}
          data-testid="plugins-home-chip-saved"
        >
          <Icon name="star" size={11} />
          <span>{t('pluginsHome.featured')}</span>
          <span className="plugins-home__chip-count">{savedCount}</span>
        </button>
        <CategoryPill
          slug={null}
          label={t('common.all')}
          count={totalVisible}
          active={selectedSlug === null}
          onPick={onPick}
          variant="all"
        />
        {options.map((opt) => (
          <CategoryPill
            key={opt.slug}
            slug={opt.slug}
            label={opt.label}
            count={opt.count}
            active={selectedSlug === opt.slug}
            onPick={onPick}
          />
        ))}
      </div>
      <div className="plugins-home__facet-tools">
        <SortToggle value={sortOrder} onChange={onSortOrderChange} />
        <SearchInput value={query} onChange={onQueryChange} />
      </div>
    </div>
  );
}

interface SubcategoryRowProps {
  parent: FacetOption | undefined;
  options: FacetOption[];
  selectedSlug: string | null;
  onPick: (slug: string | null) => void;
}

export function SubcategoryRow({ parent, options, selectedSlug, onPick }: SubcategoryRowProps) {
  const t = useT();
  if (!parent || options.length === 0) return null;
  return (
    <div
      className="plugins-home__facet-row plugins-home__facet-row--inline plugins-home__facet-row--sub"
      data-testid={`plugins-home-row-subcategory-${parent.slug}`}
    >
      <div
        className="plugins-home__facet-pills"
        role="tablist"
        aria-label={t('pluginsHome.subcategoryFilterAria', { label: parent.label })}
      >
        <CategoryPill
          slug={null}
          label={t('pluginsHome.allCategory', { label: pluginFacetLabel(parent.slug, parent.label, t) })}
          count={parent.count}
          active={selectedSlug === null}
          onPick={onPick}
          variant="sub-all"
          testId={`plugins-home-pill-subcategory-${parent.slug}-all`}
        />
        {options.map((opt) => (
          <CategoryPill
            key={opt.slug}
            slug={opt.slug}
            label={opt.label}
            count={opt.count}
            active={selectedSlug === opt.slug}
            onPick={onPick}
            testId={`plugins-home-pill-subcategory-${parent.slug}-${opt.slug}`}
          />
        ))}
      </div>
    </div>
  );
}

interface CategoryPillProps {
  slug: string | null;
  label: string;
  count: number;
  active: boolean;
  variant?: 'all' | 'sub-all';
  testId?: string;
  onPick: (slug: string | null) => void;
}

function CategoryPill({ slug, label, count, active, variant, testId, onPick }: CategoryPillProps) {
  const t = useT();
  const displayLabel = slug ? pluginFacetLabel(slug, label, t) : label;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={[
        'plugins-home__pill',
        active ? 'is-active' : '',
        variant === 'all' ? 'plugins-home__pill--all' : '',
        variant === 'sub-all' ? 'plugins-home__pill--sub-all' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onPick(slug)}
      // Planned child buckets stay visible even before the catalog
      // has examples for each scene. The `data-empty` flag gives
      // those zero-count buckets a lighter treatment without adding
      // placeholder cards to the starter grid.
      data-empty={count === 0 ? 'true' : 'false'}
      data-testid={testId ?? `plugins-home-pill-category-${slug ?? 'all'}`}
    >
      <span>{displayLabel}</span>
      <span className="plugins-home__pill-count">{count}</span>
    </button>
  );
}

function pluginFacetLabel(slug: string, fallback: string, t: ReturnType<typeof useT>): string {
  switch (slug) {
    case 'import': return t('pluginsHome.facet.import');
    case 'create': return t('pluginsHome.facet.create');
    case 'export': return t('pluginsHome.facet.export');
    case 'share': return t('pluginsHome.facet.share');
    case 'deploy': return t('pluginsHome.facet.deploy');
    case 'refine': return t('pluginsHome.facet.refine');
    case 'extend': return t('pluginsHome.facet.extend');
    case 'from-figma': return t('pluginsHome.facet.figma');
    case 'from-github': return t('pluginsHome.facet.github');
    case 'from-code': return t('pluginsHome.facet.codeFolder');
    case 'from-url': return t('pluginsHome.facet.url');
    case 'from-screenshot': return t('pluginsHome.facet.screenshot');
    case 'from-pdf': return t('pluginsHome.facet.pdf');
    case 'from-pptx': return t('pluginsHome.facet.pptx');
    case 'from-framer': return t('pluginsHome.facet.framer');
    case 'from-webflow': return t('pluginsHome.facet.webflow');
    case 'prototype': return t('homeHero.chip.prototype');
    case 'deck': return t('pluginsHome.facet.slides');
    case 'design-system': return t('entry.navDesignSystems');
    case 'hyperframes': return t('homeHero.chip.hyperframes');
    case 'image': return t('homeHero.chip.image');
    case 'video': return t('homeHero.chip.video');
    case 'audio': return t('homeHero.chip.audio');
    case 'public-link': return t('pluginsHome.facet.publicLink');
    case 'github-pr': return t('pluginsHome.facet.githubPr');
    case 'github-gist': return t('pluginsHome.facet.githubGist');
    default: return pluginSubfacetLabel(slug, fallback, t);
  }
}

interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
}

// Compact search field that lives in the section head. Search composes
// with the category selection via AND inside the hook, so a query
// narrows whatever category the user has already picked rather than
// discarding the category context.
function SearchInput({ value, onChange }: SearchInputProps) {
  const t = useT();
  return (
    <div className="plugins-home__search">
      <Icon name="search" size={12} className="plugins-home__search-icon" />
      <input
        type="search"
        className="plugins-home__search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('pluginsHome.searchPlaceholder')}
        aria-label={t('pluginsHome.searchAria')}
        data-testid="plugins-home-search"
        spellCheck={false}
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          className="plugins-home__search-clear"
          onClick={() => onChange('')}
          aria-label={t('pluginsHome.clearSearch')}
          data-testid="plugins-home-search-clear"
        >
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </div>
  );
}
