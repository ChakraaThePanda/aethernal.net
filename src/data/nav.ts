// The site menu. Also published as /nav.json, which the Aethernal account panel
// (wow.aethernal.net) reads so both sites share one menu: edit it here only.
export interface NavItem {
  href: string;
  label: string;
}

export const SITE = 'https://aethernal.net';

export const nav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/wow/', label: 'WoW' },
  { href: '/mtg/', label: 'MTG' },
  { href: 'https://wow.aethernal.net/', label: 'Server' },
];
