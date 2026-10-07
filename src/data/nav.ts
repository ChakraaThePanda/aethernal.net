// The site menu. Also published as /nav.json, which the Aethernal account panel
// (wow.aethernal.net) reads so both sites share one menu: edit it here only.
export interface NavItem {
  href: string;
  label: string;
  group?: string; // consecutive items with the same group get a divider and a small label
}

export const SITE = 'https://aethernal.net';

export const nav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/mtg/', label: 'MTG' },
  { href: '/wow/', label: 'Characters', group: 'WoW' },
  { href: 'https://wow.aethernal.net/', label: 'Server', group: 'WoW' },
];
