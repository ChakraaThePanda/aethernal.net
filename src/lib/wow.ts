// Shared WoW display helpers for the retail (build-time) and Aethernal (browser) widgets.

export const CLASS_COLORS: Record<string, string> = {
  'Warrior': '#c69b6d',
  'Paladin': '#f48cba',
  'Hunter': '#aad372',
  'Rogue': '#fff468',
  'Priest': '#ffffff',
  'Death Knight': '#c41e3a',
  'Shaman': '#0070dd',
  'Mage': '#3fc7eb',
  'Warlock': '#8788ee',
  'Monk': '#00ff98',
  'Druid': '#ff7c0a',
  'Demon Hunter': '#a330c9',
  'Evoker': '#33937f',
};

// Character card order everywhere on the WoW page: highest level first, then by owner in the
// order of the filter buttons (owners missing from the list go last), then by name.
export function sortRoster<T extends { level?: number | null; owner?: string | null; name: string }>(chars: T[], owners: string[]): T[] {
  const rank = (o?: string | null) => (o && owners.includes(o) ? owners.indexOf(o) : owners.length);
  return [...chars].sort((a, b) =>
    ((b.level ?? 0) - (a.level ?? 0)) || (rank(a.owner) - rank(b.owner)) || a.name.localeCompare(b.name));
}

export const classColor = (name: string) => CLASS_COLORS[name] ?? 'var(--text)';

// Battle.net quality types and AzerothCore quality ids, both mapped to the --qN CSS variables.
const QUALITY_TYPES = ['POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM'];
export const qualityVar = (q: string | number) =>
  `var(--q${typeof q === 'number' ? q : Math.max(0, QUALITY_TYPES.indexOf(q))})`;

// Wowhead icons for characters without a Blizzard render (the Aethernal server).
const ICONS = 'https://wow.zamimg.com/images/wow/icons/large';
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '');
export const classIconUrl = (className: string) => `${ICONS}/classicon_${slug(className)}.jpg`;
