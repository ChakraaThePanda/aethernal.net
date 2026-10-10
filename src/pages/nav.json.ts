import { nav, SITE } from '../data/nav';

// Absolute URLs so the account panel can use them as-is from its own domain.
export function GET() {
  const items = nav.map((item) => ({
    ...item,
    href: new URL(item.href, SITE).href,
    ...(item.groupIcon && { groupIcon: new URL(item.groupIcon, SITE).href }),
    ...(item.children && {
      children: item.children.map((child) => ({ ...child, href: new URL(child.href, SITE).href })),
    }),
  }));
  return new Response(JSON.stringify({ items }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
