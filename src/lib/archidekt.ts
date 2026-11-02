// Looks up each deck's featured art and commander(s) from Archidekt's public API at build time.
// Failures just mean the card shows without art or commander, so a flaky API never breaks a deploy.
// Archidekt rate-limits bursts, so requests go through a small queue and retry on 429.

export interface Commander {
  name: string;
  image: string; // full card image on Scryfall, for the hover preview
}

export interface DeckInfo {
  art: string | null;
  commanders: Commander[];
  colors: string[]; // the commanders' combined color identity as WUBRG letters, in that order
  price: number | null; // TCGplayer total in USD, priced the same way as the MTG spreadsheet
  updatedAt: string | null;
}

const CONCURRENCY = 2;
const cache = new Map<number, Promise<DeckInfo>>();
let active = 0;
const waiting: (() => void)[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= CONCURRENCY) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

// The deck data the live site was last built with (pages/decks.json.ts). Any deck Archidekt doesn't
// answer for keeps its last good art, commanders and date instead of going blank.
const LAST_GOOD = 'https://aethernal.net/decks.json';
let lastGood: Promise<Record<string, DeckInfo>> | null = null;
const loadLastGood = () =>
  (lastGood ??= fetch(LAST_GOOD, { signal: AbortSignal.timeout(15_000) })
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({})));

// Archidekt card uids are Scryfall ids, and Scryfall's image CDN is keyed by them.
const scryfallImage = (uid: string) => `https://cards.scryfall.io/normal/front/${uid[0]}/${uid[1]}/${uid}.jpg`;

// Matches the spreadsheet's ARCHIDEKT_PRICE: TCGplayer (foil price for foils), falling back to the
// regular price and then other vendors only when a price is missing. Cards whose categories are all
// left out of the price on Archidekt (Maybeboard, usually) don't count.
function deckPrice(deck: any): number {
  const priceable = new Map<string, boolean>((deck.categories ?? []).map((c: any) => [c.name, !!c.includedInPrice]));
  let total = 0;
  for (const row of deck.cards ?? []) {
    const qty = Number(row.quantity) || 0;
    const cats: string[] = row.categories ?? [];
    if (!qty || (cats.length && !cats.some((c) => priceable.get(c) !== false))) continue;
    const prices = row.card?.prices;
    if (!prices) continue;
    const foil = String(row.modifier ?? '').toLowerCase().includes('foil');
    const key = [foil ? 'tcgfoil' : 'tcg', 'tcg', 'ck', 'cm', 'tcgfoil', 'ckfoil', 'cmfoil'].find((k) => typeof prices[k] === 'number');
    if (key) total += prices[key] * qty;
  }
  return Math.round(total * 100) / 100;
}

const WUBRG: [string, string][] = [['White', 'W'], ['Blue', 'U'], ['Black', 'B'], ['Red', 'R'], ['Green', 'G']];

async function fetchDeck(id: number): Promise<DeckInfo> {
  let reason = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://archidekt.com/api/decks/${id}/`, {
        signal: AbortSignal.timeout(15_000),
      });
      reason = `HTTP ${res.status}`;
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) break;
      const deck = await res.json();
      const commanderCards = (deck.cards ?? []).filter((c: any) => (c.categories ?? []).includes('Commander'));
      const commanders = commanderCards.map((c: any) => ({ name: c.card.oracleCard.name, image: scryfallImage(c.card.uid) }));
      const identity = new Set<string>(commanderCards.flatMap((c: any) => c.card.oracleCard.colorIdentity ?? []));
      const colors = WUBRG.filter(([name]) => identity.has(name)).map(([, letter]) => letter);
      return { art: deck.customFeatured || deck.featured || null, commanders, colors, price: deckPrice(deck), updatedAt: deck.updatedAt ?? null };
    } catch (err) {
      reason = (err as Error).message;
      await sleep(1000 * 2 ** attempt);
    }
  }
  const saved = (await loadLastGood())[id];
  console.warn(`[archidekt] could not load deck ${id} (${reason})${saved ? ", using the live site's last copy" : ''}`);
  // Copies saved before colors and prices existed don't have them.
  return saved
    ? { ...saved, colors: saved.colors ?? [], price: saved.price ?? null }
    : { art: null, commanders: [], colors: [], price: null, updatedAt: null };
}

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const usd = (n: number) => usdFormat.format(n);

export function deckInfo(id: number): Promise<DeckInfo> {
  if (!cache.has(id)) cache.set(id, withSlot(() => fetchDeck(id)));
  return cache.get(id)!;
}
