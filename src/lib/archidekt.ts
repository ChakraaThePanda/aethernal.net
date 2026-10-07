// Looks up each deck's featured (commander) art from Archidekt's public API at build time.
// Failures just mean the card shows without art, so a flaky API never breaks a deploy.
// Archidekt rate-limits bursts, so requests go through a small queue and retry on 429.

const CONCURRENCY = 2;
const cache = new Map<number, Promise<string | null>>();
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

async function fetchArt(id: number): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://archidekt.com/api/decks/${id}/small/`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) return null;
      const deck = await res.json();
      return deck.customFeatured || deck.featured || null;
    } catch {
      await sleep(1000 * 2 ** attempt);
    }
  }
  console.warn(`[archidekt] no art for deck ${id}`);
  return null;
}

export function deckArt(id: number): Promise<string | null> {
  if (!cache.has(id)) cache.set(id, withSlot(() => fetchArt(id)));
  return cache.get(id)!;
}
