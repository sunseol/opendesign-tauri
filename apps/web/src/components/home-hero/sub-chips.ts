import type { InstalledPluginRecord } from '@open-design/contracts';
import type { IconName } from '../Icon';
import {
  buildSubcategoryCatalog,
  extractSubcategories,
  type FacetOption,
} from '../plugins-home/facets';

export type SubChipParentId = 'prototype' | 'deck';

export interface HomeHeroSubChip {
  readonly slug: string;
  readonly label: string;
  readonly icon: IconName;
}

const SUBCATEGORY_ICONS: Record<string, IconName> = {
  'business-dashboards': 'grid',
  'app-prototypes': 'blocks',
  'landing-marketing': 'link',
  'developer-tools': 'file-code',
  'docs-reports': 'file',
  'brand-design': 'palette',
  'pitch-business': 'present',
  'course-training': 'sun',
  'reports-briefings': 'file',
  'product-sales': 'star',
  'engineering-talks': 'file-code',
  'creative-decks': 'palette',
};

const DEFAULT_SUBCATEGORY_ICON: IconName = 'blocks';

export function isSubChipParent(chipId: string | null): chipId is SubChipParentId {
  return chipId === 'prototype' || chipId === 'deck';
}

export function subChipsForChip(
  chipId: string | null,
  plugins: readonly InstalledPluginRecord[],
): HomeHeroSubChip[] {
  if (!isSubChipParent(chipId)) return [];
  const catalog = buildSubcategoryCatalog(Array.from(plugins));
  const options: readonly FacetOption[] = catalog[chipId] ?? [];
  return options
    .filter((option) => option.count > 0)
    .map((option) => ({
      slug: option.slug,
      label: option.label,
      icon: SUBCATEGORY_ICONS[option.slug] ?? DEFAULT_SUBCATEGORY_ICON,
    }));
}

export function filterPluginsBySubChip(
  plugins: readonly InstalledPluginRecord[],
  parent: SubChipParentId,
  subcategorySlug: string,
): InstalledPluginRecord[] {
  return plugins.filter((plugin) =>
    extractSubcategories(plugin, parent).includes(subcategorySlug),
  );
}
