import { nav, NAV_VERSION, SITE } from '../data/nav';

const absolute = (href: string) => new URL(href, SITE).href;

// Absolute URLs so the account panel can use them as-is from its own domain.
export function GET() {
  const items = nav.map((item) => ({
    ...item,
    ...(item.href && { href: absolute(item.href) }),
    ...(item.image && { image: absolute(item.image) }),
    ...(item.tiles && { tiles: item.tiles.map((tile) => ({ ...tile, href: absolute(tile.href) })) }),
  }));
  return new Response(JSON.stringify({ version: NAV_VERSION, items }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
