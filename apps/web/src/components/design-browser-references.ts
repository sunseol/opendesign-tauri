import { hostnameFromUrl } from './design-browser-model';

export type ReferenceSite = {
  readonly label: string;
  readonly url: string;
  readonly detail: string;
};

export type ReferenceGroupId =
  | 'inspiration'
  | 'interfaces'
  | 'motion'
  | 'color'
  | 'type'
  | 'icons'
  | 'illustration'
  | 'photography'
  | '3d'
  | 'mockups'
  | 'systems'
  | 'components'
  | 'guidelines'
  | 'tools';

export type ReferenceGroup = {
  readonly id: ReferenceGroupId;
  readonly title: string;
  readonly sites: readonly ReferenceSite[];
};

export const REFERENCE_GROUPS = [
  {
    id: 'inspiration',
    title: 'Inspiration',
    sites: [
      { label: 'Dribbble', url: 'https://dribbble.com/', detail: 'Design shots and UI inspiration.' },
      { label: 'Behance', url: 'https://www.behance.net/', detail: 'Creative portfolios and case studies.' },
      { label: 'Awwwards', url: 'https://www.awwwards.com/', detail: 'Award-winning website design.' },
      { label: 'Godly', url: 'https://godly.website/', detail: 'Curated modern web design.' },
      { label: 'Land-book', url: 'https://land-book.com/', detail: 'Landing page gallery and patterns.' },
    ],
  },
  {
    id: 'interfaces',
    title: 'Real Interfaces',
    sites: [
      { label: 'Mobbin', url: 'https://mobbin.com/', detail: 'Real app screens and UI patterns.' },
      { label: 'Screenlane', url: 'https://screenlane.com/', detail: 'Latest UI design patterns from apps.' },
      { label: 'Page Flows', url: 'https://pageflows.com/', detail: 'Real product user flows and onboarding.' },
      { label: 'UI Sources', url: 'https://www.uisources.com/', detail: 'Interaction patterns from top apps.' },
      { label: 'Collect UI', url: 'https://collectui.com/', detail: 'Daily UI collection by category.' },
    ],
  },
  {
    id: 'motion',
    title: 'Motion',
    sites: [
      { label: 'GSAP', url: 'https://gsap.com/', detail: 'Production animation engine and examples.' },
      { label: 'Animations.dev', url: 'https://animations.dev/', detail: 'Animation patterns and interaction examples.' },
      { label: 'Transitions', url: 'https://transitions.dev/', detail: 'Transition patterns for modern interfaces.' },
      { label: 'Motion Sites', url: 'https://motionsites.ai/', detail: 'High-end motion and interaction references.' },
      { label: 'Motion.page Showcase', url: 'https://motion.page/showcase/', detail: 'Scroll and timeline animation inspiration.' },
      { label: 'Animography', url: 'https://animography.net/', detail: 'Animated type and kinetic lettering.' },
      { label: 'React Bits Shiny Text', url: 'https://reactbits.dev/text-animations/shiny-text', detail: 'React text animation reference for shiny kinetic type.' },
    ],
  },
  {
    id: 'color',
    title: 'Color',
    sites: [
      { label: 'Coolors', url: 'https://coolors.co/', detail: 'Fast color palette generator.' },
      { label: 'Color Hunt', url: 'https://colorhunt.co/', detail: 'Curated color palettes.' },
      { label: 'Realtime Colors', url: 'https://www.realtimecolors.com/', detail: 'Preview palettes on a real UI.' },
      { label: 'Adobe Color', url: 'https://color.adobe.com/', detail: 'Color wheel and harmony rules.' },
      { label: 'Happy Hues', url: 'https://www.happyhues.co/', detail: 'Palettes shown in real context.' },
    ],
  },
  {
    id: 'type',
    title: 'Typography',
    sites: [
      { label: 'Google Fonts', url: 'https://fonts.google.com/', detail: 'Open-source font library.' },
      { label: 'Fontshare', url: 'https://www.fontshare.com/', detail: 'Quality fonts free for commercial use.' },
      { label: 'Typewolf', url: 'https://www.typewolf.com/', detail: 'Fonts in use and pairing guidance.' },
      { label: 'Fontpair', url: 'https://www.fontpair.co/', detail: 'Font pairing suggestions.' },
      { label: 'Fonts In Use', url: 'https://fontsinuse.com/', detail: 'Typography in real-world design.' },
    ],
  },
  {
    id: 'icons',
    title: 'Icons',
    sites: [
      { label: 'The SVG', url: 'https://thesvg.org/', detail: 'SVG assets and vector references.' },
      { label: 'SVG Logos', url: 'https://svglogos.dev/', detail: 'Clean SVG logos for product and brand mocks.' },
      { label: 'Lobe Icons', url: 'https://icons.lobehub.com/', detail: 'Product and AI-brand icons for interfaces.' },
      { label: 'Iconify', url: 'https://icon-sets.iconify.design/', detail: '200k+ open-source icons in one place.' },
      { label: 'Lucide', url: 'https://lucide.dev/', detail: 'Clean, consistent open icon set.' },
      { label: 'Heroicons', url: 'https://heroicons.com/', detail: 'Tailwind-made SVG icons.' },
      { label: 'SVG Repo', url: 'https://www.svgrepo.com/', detail: 'Free SVG vectors and icons.' },
    ],
  },
  {
    id: 'illustration',
    title: 'Illustration',
    sites: [
      { label: 'Storyset', url: 'https://storyset.com/', detail: 'Customizable vector illustrations.' },
      { label: 'unDraw', url: 'https://undraw.co/', detail: 'Open-source MIT illustrations.' },
      { label: 'Blush', url: 'https://blush.design/', detail: 'Mix-and-match illustrations.' },
      { label: 'Lummi', url: 'https://www.lummi.ai/', detail: 'Free AI-generated visuals.' },
      { label: 'Whirrls', url: 'https://www.whirrls.com/', detail: 'Hand-drawn image references.' },
      { label: 'World in Dots', url: 'https://www.worldindots.com/', detail: 'Dot-map and data-viz references.' },
    ],
  },
  {
    id: 'photography',
    title: 'Photography',
    sites: [
      { label: 'Unsplash', url: 'https://unsplash.com/', detail: 'Free high-resolution photos.' },
      { label: 'Pexels', url: 'https://www.pexels.com/', detail: 'Free stock photos and video.' },
      { label: 'Pixabay', url: 'https://pixabay.com/', detail: 'Royalty-free images and media.' },
      { label: 'Cosmos', url: 'https://www.cosmos.so/', detail: 'Visual discovery and mood boards.' },
    ],
  },
  {
    id: '3d',
    title: '3D & Graphics',
    sites: [
      { label: 'Spline', url: 'https://spline.design/', detail: 'Browser-based 3D design.' },
      { label: 'Three.js Examples', url: 'https://threejs.org/examples/', detail: 'WebGL 3D references and demos.' },
      { label: 'Womp', url: 'https://womp.com/', detail: 'Easy in-browser 3D creation.' },
      { label: 'Pixcap', url: 'https://pixcap.com/', detail: '3D icons, mockups, and scenes.' },
    ],
  },
  {
    id: 'mockups',
    title: 'Mockups',
    sites: [
      { label: 'Shots', url: 'https://shots.so/', detail: 'Device and browser mockups.' },
      { label: 'Mockuuups Studio', url: 'https://mockuuups.studio/', detail: 'Drag-and-drop device mockups.' },
      { label: 'Angle', url: 'https://angle.sh/', detail: '3D device mockup library.' },
      { label: 'Rotato', url: 'https://rotato.app/', detail: 'Animated 3D product mockups.' },
    ],
  },
  {
    id: 'systems',
    title: 'Design Systems',
    sites: [
      { label: 'Impeccable Style', url: 'https://impeccable.style/', detail: 'High-quality style and interface references.' },
      { label: 'Styles Refero', url: 'https://styles.refero.design/', detail: 'Design style references and visual systems.' },
      { label: 'Brandfetch', url: 'https://brandfetch.com/', detail: 'Brand assets, logos, and identity.' },
      { label: 'Design Systems Repo', url: 'https://designsystemsrepo.com/', detail: 'Gallery of public design systems.' },
      { label: 'Startups Gallery', url: 'https://startups.gallery/', detail: 'Top startup product and brand references.' },
    ],
  },
  {
    id: 'components',
    title: 'Components',
    sites: [
      { label: 'Base UI', url: 'https://base-ui.com/', detail: 'Unstyled accessible primitives for custom systems.' },
      { label: 'shadcn/ui', url: 'https://ui.shadcn.com/', detail: 'Composable React components built on Radix and Tailwind.' },
      { label: 'HeroUI', url: 'https://www.heroui.com/', detail: 'Modern React component library and design system.' },
      { label: 'Radix UI', url: 'https://www.radix-ui.com/', detail: 'Accessible low-level UI primitives.' },
      { label: 'React Aria', url: 'https://react-spectrum.adobe.com/react-aria/', detail: 'Accessible behavior primitives from Adobe.' },
      { label: 'Headless UI', url: 'https://headlessui.com/', detail: 'Unstyled accessible components for Tailwind projects.' },
      { label: 'MUI', url: 'https://mui.com/', detail: 'Material-based React component ecosystem.' },
      { label: 'Mantine', url: 'https://mantine.dev/', detail: 'Full-featured React components and hooks.' },
      { label: 'Chakra UI', url: 'https://chakra-ui.com/', detail: 'Accessible React components with theme tokens.' },
      { label: 'Ant Design', url: 'https://ant.design/', detail: 'Enterprise component system and patterns.' },
      { label: 'Ark UI', url: 'https://ark-ui.com/', detail: 'Headless components across modern frameworks.' },
      { label: 'daisyUI', url: 'https://daisyui.com/', detail: 'Tailwind CSS component classes and themes.' },
    ],
  },
  {
    id: 'guidelines',
    title: 'Guidelines & A11y',
    sites: [
      { label: 'Apple HIG', url: 'https://developer.apple.com/design/human-interface-guidelines', detail: 'Apple platform design guidelines.' },
      { label: 'Material Design', url: 'https://m3.material.io/', detail: "Google's Material Design 3." },
      { label: 'Laws of UX', url: 'https://lawsofux.com/', detail: 'UX principles and heuristics.' },
      { label: 'WebAIM Contrast', url: 'https://webaim.org/resources/contrastchecker/', detail: 'Color contrast checker.' },
      { label: 'The A11y Project', url: 'https://www.a11yproject.com/', detail: 'Accessibility checklist and patterns.' },
    ],
  },
  {
    id: 'tools',
    title: 'Tools & Resources',
    sites: [
      { label: 'Toolfolio', url: 'https://toolfolio.io/', detail: 'Design tools, resources, and collections.' },
      { label: 'GetDesign', url: 'https://getdesign.md/', detail: 'Curated design resources.' },
      { label: 'Taste Skill', url: 'https://www.tasteskill.dev/', detail: 'Design taste training and critique references.' },
      { label: 'UI Goodies', url: 'https://www.uigoodies.com/', detail: 'Hand-picked design resources.' },
      { label: 'Sidebar', url: 'https://sidebar.io/', detail: 'Five design links, every day.' },
      { label: 'Superset', url: 'https://github.com/superset-sh/superset', detail: 'Reference implementation for embedded browser workflows.' },
    ],
  },
] as const satisfies readonly ReferenceGroup[];

export const REFERENCE_TOTAL = REFERENCE_GROUPS.reduce((sum, group) => sum + group.sites.length, 0);

export function filterReferenceGroups(
  groups: readonly ReferenceGroup[],
  category: ReferenceGroupId | 'all' | string,
  query: string,
): readonly ReferenceGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  return groups
    .filter((group) => category === 'all' || group.id === category)
    .map((group) => {
      if (!needle) return group;
      if (group.title.toLocaleLowerCase().includes(needle)) return group;
      const sites = group.sites.filter(
        (site) =>
          site.label.toLocaleLowerCase().includes(needle) ||
          site.detail.toLocaleLowerCase().includes(needle) ||
          hostnameFromUrl(site.url).toLocaleLowerCase().includes(needle),
      );
      return { ...group, sites };
    })
    .filter((group) => group.sites.length > 0);
}
