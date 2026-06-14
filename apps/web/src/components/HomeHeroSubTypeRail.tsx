import { useT } from '../i18n';
import { Icon } from './Icon';
import type { HomeHeroSubChip } from './home-hero/sub-chips';
import { pluginSubfacetLabel } from './plugins-home/subfacetLabel';

interface Props {
  readonly subChips: readonly HomeHeroSubChip[];
  readonly selectedSlug: string | null;
  readonly pluginsLoading: boolean;
  readonly onPickSubChip: (subChip: HomeHeroSubChip) => void;
  readonly onSelectAll: () => void;
}

export function HomeHeroSubTypeRail({
  subChips,
  selectedSlug,
  pluginsLoading,
  onPickSubChip,
  onSelectAll,
}: Props) {
  const t = useT();
  const allActive = selectedSlug === null;
  return (
    <div
      className="home-hero__subtype-row"
      data-testid="home-hero-subtype-row"
      role="tablist"
      aria-label={t('homeHero.railAria')}
    >
      <button
        type="button"
        className={`home-hero__subtype-chip${allActive ? ' is-active' : ''}`}
        data-sub-chip-id="all"
        data-testid="home-hero-subtype-all"
        onClick={onSelectAll}
        disabled={pluginsLoading}
        role="tab"
        aria-selected={allActive}
      >
        <span className="home-hero__subtype-chip-label">{t('common.all')}</span>
      </button>
      {subChips.map((subChip) => {
        const isActive = subChip.slug === selectedSlug;
        const classNames = ['home-hero__subtype-chip'];
        if (isActive) classNames.push('is-active');
        return (
          <button
            key={subChip.slug}
            type="button"
            className={classNames.join(' ')}
            data-sub-chip-id={subChip.slug}
            data-testid={`home-hero-subtype-${subChip.slug}`}
            onClick={() => onPickSubChip(subChip)}
            disabled={pluginsLoading}
            role="tab"
            aria-selected={isActive}
          >
            <Icon name={subChip.icon} size={13} className="home-hero__subtype-chip-icon" />
            <span className="home-hero__subtype-chip-label">
              {pluginSubfacetLabel(subChip.slug, subChip.label, t)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
