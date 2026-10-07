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

// Archidekt card uids are Scryfall ids, and Scryfall's image CDN is keyed by them.
const scryfallImage = (uid: string) => `https://cards.scryfall.io/normal/front/${uid[0]}/${uid[1]}/${uid}.jpg`;

async function fetchDeck(id: number): Promise<DeckInfo> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://archidekt.com/api/decks/${id}/`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) break;
      const deck = await res.json();
      const commanders = (deck.cards ?? [])
        .filter((c: any) => (c.categories ?? []).includes('Commander'))
        .map((c: any) => ({ name: c.card.oracleCard.name, image: scryfallImage(c.card.uid) }));
      return { art: deck.customFeatured || deck.featured || null, commanders, updatedAt: deck.updatedAt ?? null };
    } catch {
      await sleep(1000 * 2 ** attempt);
    }
  }
  console.warn(`[archidekt] could not load deck ${id}`);
  return { art: null, commanders: [], updatedAt: null };
}

export function deckInfo(id: number): Promise<DeckInfo> {
  if (!cache.has(id)) cache.set(id, withSlot(() => fetchDeck(id)));
  return cache.get(id)!;
}
