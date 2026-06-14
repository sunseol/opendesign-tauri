import { useMemo, useState } from 'react';

import { hostnameFromUrl, referenceIconUrl } from './design-browser-model';
import {
  REFERENCE_GROUPS,
  REFERENCE_TOTAL,
  filterReferenceGroups,
  type ReferenceGroupId,
  type ReferenceSite,
} from './design-browser-references';
import { Icon } from './Icon';

export type ReferenceCategoryFilter = ReferenceGroupId | 'all';

export type DesignBrowserReferenceBoardProps = {
  readonly initialCategory?: ReferenceCategoryFilter;
  readonly initialQuery?: string;
  readonly onOpenReference: (site: ReferenceSite) => void;
  readonly onSearchFocus?: () => void;
};

export function DesignBrowserReferenceBoard({
  initialCategory = 'all',
  initialQuery = '',
  onOpenReference,
  onSearchFocus,
}: DesignBrowserReferenceBoardProps) {
  const [activeCategory, setActiveCategory] = useState<ReferenceCategoryFilter>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const trimmedQuery = query.trim();
  const visibleGroups = useMemo(
    () => filterReferenceGroups(REFERENCE_GROUPS, activeCategory, query),
    [activeCategory, query],
  );

  return (
    <div className="db-reference-shell" data-testid="design-browser-reference-board">
      <div className="db-reference-toolbar">
        <div className="db-reference-heading">
          <h2>Reference Board</h2>
          <span>{REFERENCE_TOTAL}</span>
        </div>
        <div className="db-reference-search">
          <Icon name="search" size={13} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onFocus={onSearchFocus}
            placeholder="Search references"
            aria-label="Search references"
          />
          {trimmedQuery ? (
            <button type="button" aria-label="Clear reference search" onClick={() => setQuery('')}>
              <Icon name="close" size={12} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="db-reference-tabs" role="tablist" aria-label="Reference categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'all'}
          className={activeCategory === 'all' ? 'is-active' : undefined}
          onClick={() => setActiveCategory('all')}
        >
          All <span>{REFERENCE_TOTAL}</span>
        </button>
        {REFERENCE_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === group.id}
            className={activeCategory === group.id ? 'is-active' : undefined}
            onClick={() => setActiveCategory(group.id)}
          >
            {group.title} <span>{group.sites.length}</span>
          </button>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <div className="db-reference-empty" role="status">
          <p>No references match {trimmedQuery ? `"${trimmedQuery}"` : 'the current filters'}.</p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('all');
              setQuery('');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="db-reference-board">
          {visibleGroups.map((group) => (
            <section
              key={group.id}
              className="db-reference-group"
              aria-labelledby={`db-reference-group-${group.id}`}
            >
              <h3 id={`db-reference-group-${group.id}`}>
                {group.title} <span>{group.sites.length}</span>
              </h3>
              <div className="db-reference-list">
                {group.sites.map((site) => (
                  <article key={site.url} className="db-reference-card">
                    <div className="db-reference-card-main">
                      <ReferenceSiteIcon url={site.url} />
                      <div>
                        <h4>{site.label}</h4>
                        <p>{hostnameFromUrl(site.url)}</p>
                      </div>
                    </div>
                    <p>{site.detail}</p>
                    <button type="button" aria-label={`Open ${site.label}`} onClick={() => onOpenReference(site)}>
                      <Icon name="external-link" size={13} />
                      Open
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferenceSiteIcon({ url }: { readonly url: string }) {
  const iconUrl = referenceIconUrl(url);
  return (
    <span className="db-reference-icon">
      {iconUrl ? <img src={iconUrl} alt="" /> : <Icon name="link" size={13} />}
    </span>
  );
}
