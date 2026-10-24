// The site menu. Also published as /nav.json, which the Aethernal account panel
// (wow.aethernal.net) reads so both sites share one menu: edit it here only.
export interface NavTile {
  href: string;
  label: string;
  description: string;
  // One of NAV_ICONS. The panel keeps its own copy of the icons (src/siteNav.js).
  icon: keyof typeof NAV_ICONS;
  // Starts a new section of tiles: a labelled divider before this tile.
  section?: string;
}

export interface NavItem {
  label: string;
  // A plain link, or with tiles, a dropdown of tiles (one per row) on desktop that is always
  // listed in the phone menu.
  href?: string;
  image?: string;
  tiles?: NavTile[];
}

export const SITE = 'https://aethernal.net';

// Bump when the shape of nav.json changes, so the panel keeps its own menu until both match.
export const NAV_VERSION = 2;

// Inner markup of 24x24 line icons, drawn with the surrounding svg's stroke.
export const NAV_ICONS = {
  characters:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.5 3.6-5.3 6.5-5.3s5.3 1.8 6.5 5.3"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4 1.8 5 4.4"/>',
  realm: '<path d="M12 2.5l2.2 5.2 5.3.6-4 3.6 1.2 5.3L12 14.5l-4.7 2.7 1.2-5.3-4-3.6 5.3-.6z"/><path d="M5 21h14"/>',
  armory: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
};

export const nav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/mtg/', label: 'MTG' },
  {
    label: 'World of Warcraft',
    image: '/images/wow-icon.png',
    tiles: [
      { href: '/wow/', label: 'Our Characters', description: 'Pat and Mimi on Retail, Forever and Aethernal', icon: 'characters' },
      { href: 'https://wow.aethernal.net/', label: 'Account Panel', description: 'Sign up or manage your account', icon: 'realm', section: 'Aethernal server' },
      { href: 'https://wow.aethernal.net/armory', label: 'Armory', description: 'Look up Aethernal characters and guilds', icon: 'armory' },
    ],
  },
];
