// Shared WoW display helpers for the modern (build-time) and Aethernal (browser) widgets.

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

// Owners whose characters always list first on the WoW page, ahead of everyone else's.
export const PRIORITY_OWNERS = ['Pat', 'Mimi'];

// Character card order everywhere on the WoW page: Pat & Mimi's characters first, then everyone
// else's; within each group highest level first, then by owner in the order of the filter buttons
// (owners missing from the list go last), then by name.
export function sortRoster<T extends { level?: number | null; owner?: string | null; name: string }>(chars: T[], owners: string[]): T[] {
  const tier = (o?: string | null) => (o && PRIORITY_OWNERS.includes(o) ? 0 : 1);
  const rank = (o?: string | null) => (o && owners.includes(o) ? owners.indexOf(o) : owners.length);
  return [...chars].sort((a, b) =>
    (tier(a.owner) - tier(b.owner)) || ((b.level ?? 0) - (a.level ?? 0))
    || (rank(a.owner) - rank(b.owner)) || a.name.localeCompare(b.name));
}

export const classColor = (name: string) => CLASS_COLORS[name] ?? 'var(--text)';

// Battle.net quality types and AzerothCore quality ids, both mapped to the --qN CSS variables.
const QUALITY_TYPES = ['POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM'];
export const qualityVar = (q: string | number) =>
  `var(--q${typeof q === 'number' ? q : Math.max(0, QUALITY_TYPES.indexOf(q))})`;

// Wowhead icons for characters without a Blizzard render (the Aethernal server, and Forever,
// whose character-media endpoint doesn't answer yet).
const ICONS = 'https://wow.zamimg.com/images/wow/icons/large';
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '');
export const classIconUrl = (className: string) => `${ICONS}/classicon_${slug(className)}.jpg`;
export const raceIconUrl = (race: string, gender?: string | null) =>
  `${ICONS}/race_${race === 'Undead' ? 'scourge' : slug(race)}_${gender === 'Female' ? 'female' : 'male'}.jpg`;

// Forever rulesets, shown on the card in place of the realm. The API's ruleset name (or the
// fallback in characters.ts) is mapped to one of: PVE, PVP, RP-PVE, RP-PVP, Hardcore.
// Race as shown on the cards. The Skyborne races ("High Order Skyborne", ...) are too long for the
// card's one-line subtitle, so their prefix is cut to its initial: "H Skyborne".
export function raceLabel(race?: string | null): string {
  const r = race ?? '';
  const m = /^(\w)\w*(?: \w+)* (Skyborne)$/.exec(r);
  return m ? `${m[1]} ${m[2]}` : r;
}

export function rulesetLabel(ruleset?: string | null): string | null {
  if (!ruleset) return null;
  const r = ruleset.toLowerCase();
  if (r.includes('hardcore')) return 'Hardcore';
  const rp = /^rp|\brp\b|role.?play/.test(r);
  const pvp = r.includes('pvp');
  if (rp) return pvp ? 'RP-PVP' : 'RP-PVE';
  return pvp ? 'PVP' : 'PVE';
}

// Equipment in character-window order: the left column, the right column, then weapons. Battle.net
// and AzerothCore name some slots differently ('Shoulders'/'Shoulder', 'Ring 1'/'Finger'), so the
// name is normalized first. Both list rings and trinkets in order, and the sort is stable.
const PANE_ORDER = [
  'head', 'neck', 'shoulder', 'back', 'chest', 'shirt', 'tabard', 'wrist',
  'hands', 'waist', 'legs', 'feet', 'finger', 'trinket',
  'main hand', 'off hand', 'ranged',
];
const paneIndex = (slot: string) => {
  const s = slot.toLowerCase().replace(/\s*\d+$/, '').replace(/^shoulders$/, 'shoulder').replace(/^ring$/, 'finger');
  const i = PANE_ORDER.indexOf(s);
  return i < 0 ? PANE_ORDER.length : i;
};
export const sortEquipment = <T extends { slot: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => paneIndex(a.slot) - paneIndex(b.slot));
