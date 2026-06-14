import { describe, expect, it } from 'vitest';

import { referenceIconUrl } from '../../src/components/design-browser-model';
import {
  REFERENCE_GROUPS,
  REFERENCE_TOTAL,
  filterReferenceGroups,
} from '../../src/components/design-browser-references';

describe('design browser reference catalogue', () => {
  it('exposes every Reference Board category in designer workflow order', () => {
    expect(REFERENCE_GROUPS.map((group) => group.id)).toEqual([
      'inspiration',
      'interfaces',
      'motion',
      'color',
      'type',
      'icons',
      'illustration',
      'photography',
      '3d',
      'mockups',
      'systems',
      'components',
      'guidelines',
      'tools',
    ]);
  });

  it('keeps category ids, site urls, and total count stable', () => {
    const ids = REFERENCE_GROUPS.map((group) => group.id);
    const urls = REFERENCE_GROUPS.flatMap((group) => group.sites.map((site) => site.url));
    const counted = REFERENCE_GROUPS.reduce((sum, group) => sum + group.sites.length, 0);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(REFERENCE_TOTAL).toBe(counted);
    expect(REFERENCE_TOTAL).toBe(80);
  });

  it('gives every reference display text and a resolvable public icon target', () => {
    for (const group of REFERENCE_GROUPS) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.sites.length).toBeGreaterThan(0);
      for (const site of group.sites) {
        expect(site.label.length).toBeGreaterThan(0);
        expect(site.detail.length).toBeGreaterThan(0);
        expect(site.url).toMatch(/^https?:\/\//u);
        expect(referenceIconUrl(site.url)).toMatch(/^https:\/\/www\.google\.com\/s2\/favicons\?sz=64&domain=/u);
      }
    }
  });

  it('includes handoff-critical browser, asset, and component-library references', () => {
    const urls = new Set(REFERENCE_GROUPS.flatMap((group) => group.sites.map((site) => site.url)));

    expect(Array.from(urls)).toEqual(expect.arrayContaining([
      'https://thesvg.org/',
      'https://unsplash.com/',
      'https://motionsites.ai/',
      'https://motion.page/showcase/',
      'https://styles.refero.design/',
      'https://brandfetch.com/',
      'https://gsap.com/',
      'https://transitions.dev/',
      'https://fonts.google.com/',
      'https://animography.net/',
      'https://reactbits.dev/text-animations/shiny-text',
      'https://toolfolio.io/',
      'https://www.whirrls.com/',
      'https://startups.gallery/',
      'https://www.worldindots.com/',
      'https://getdesign.md/',
      'https://github.com/superset-sh/superset',
      'https://svglogos.dev/',
      'https://icons.lobehub.com/',
      'https://animations.dev/',
      'https://impeccable.style/',
      'https://www.tasteskill.dev/',
      'https://base-ui.com/',
      'https://ui.shadcn.com/',
      'https://www.heroui.com/',
    ]));
  });
});

describe('filterReferenceGroups', () => {
  it('returns every group untouched for the all category and an empty query', () => {
    const result = filterReferenceGroups(REFERENCE_GROUPS, 'all', '');

    expect(result).toEqual(REFERENCE_GROUPS);
  });

  it('narrows to a selected category', () => {
    const result = filterReferenceGroups(REFERENCE_GROUPS, 'motion', '');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('motion');
    expect(result[0]?.sites.length).toBeGreaterThan(0);
  });

  it('matches references by label, hostname, detail, or owning group title', () => {
    const byLabel = filterReferenceGroups(REFERENCE_GROUPS, 'all', 'dribbble');
    const byHostname = filterReferenceGroups(REFERENCE_GROUPS, 'all', 'unsplash.com');
    const byDetail = filterReferenceGroups(REFERENCE_GROUPS, 'all', 'contrast');
    const byTitle = filterReferenceGroups(REFERENCE_GROUPS, 'all', 'color');
    const color = REFERENCE_GROUPS.find((group) => group.id === 'color');

    expect(referenceLabels(byLabel)).toContain('Dribbble');
    expect(referenceLabels(byHostname)).toContain('Unsplash');
    expect(referenceLabels(byDetail)).toContain('WebAIM Contrast');
    expect(byTitle.find((group) => group.id === 'color')?.sites).toEqual(color?.sites);
  });

  it('drops empty groups and ignores query casing', () => {
    const result = filterReferenceGroups(REFERENCE_GROUPS, 'all', 'COOLORS');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('color');
    expect(referenceLabels(result)).toEqual(['Coolors']);
    expect(filterReferenceGroups(REFERENCE_GROUPS, 'all', 'zzz-no-such-reference')).toEqual([]);
  });
});

function referenceLabels(groups: ReturnType<typeof filterReferenceGroups>): readonly string[] {
  return groups.flatMap((group) => group.sites.map((site) => site.label));
}
