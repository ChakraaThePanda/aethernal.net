import { players } from '../data/decks';
import { deckInfo } from '../lib/archidekt';

// Every deck's Archidekt data as this build saw it. The next build falls back to it for any deck
// Archidekt doesn't answer for (see lib/archidekt.ts).
export async function GET() {
  const ids = players.flatMap((p) => [...p.decks, ...(p.precons ?? [])].map((d) => d.id));
  const entries = await Promise.all(ids.map(async (id) => [id, await deckInfo(id)] as const));
  const decks = Object.fromEntries(entries.filter(([, info]) => info.updatedAt || info.art));
  return new Response(JSON.stringify(decks), { headers: { 'Content-Type': 'application/json' } });
}
