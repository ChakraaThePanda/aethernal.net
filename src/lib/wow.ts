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

export const classColor = (name: string) => CLASS_COLORS[name] ?? 'var(--text)';

// Battle.net quality types and AzerothCore quality ids, both mapped to the --qN CSS variables.
const QUALITY_TYPES = ['POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM'];
export const qualityVar = (q: string | number) =>
  `var(--q${typeof q === 'number' ? q : Math.max(0, QUALITY_TYPES.indexOf(q))})`;
