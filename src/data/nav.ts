// The site menu. Also published as /nav.json, which the Aethernal account panel
// (wow.aethernal.net) reads so both sites share one menu: edit it here only.
export interface NavItem {
  href: string;
  label: string;
  // Consecutive items with the same group get a divider and the group's label, shown as its icon
  // when it has one.
  group?: string;
  groupIcon?: string;
  // Sub-pages: a hover menu under the item on desktop, indented under it in the phone menu.
  children?: { href: string; label: string }[];
}

export const SITE = 'https://aethernal.net';

export const nav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/mtg/', label: 'MTG' },
  { href: '/wow/', label: 'Characters', group: 'World of Warcraft', groupIcon: '/images/wow-icon.png' },
  {
    href: 'https://wow.aethernal.net/', label: 'Server', group: 'World of Warcraft', groupIcon: '/images/wow-icon.png',
    children: [{ href: 'https://wow.aethernal.net/armory', label: 'Armory' }],
  },
];
