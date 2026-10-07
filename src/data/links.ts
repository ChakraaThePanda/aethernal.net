// Destinations shown on the home page. `external` links open in a new tab.
export interface SiteLink {
  title: string;
  description: string;
  href: string;
  tag: string;
  external?: boolean;
}

export const destinations: SiteLink[] = [
  {
    title: 'Aethernal WoW Server',
    description: 'Our Wrath of the Lich King private realm. Create an account and manage your characters.',
    href: 'https://wow.aethernal.net/',
    tag: 'WoW',
    external: true,
  },
  {
    title: 'Characters',
    description: 'Live profiles for our characters on retail and on Aethernal.',
    href: '/wow/',
    tag: 'WoW',
  },
  {
    title: 'MTG Decks',
    description: 'Commander decks from the whole group, straight from Archidekt.',
    href: '/mtg/',
    tag: 'MTG',
  },
  {
    title: 'Survivor Pool',
    description: 'Picks and standings for the survivor pool.',
    href: 'https://survivor.aethernal.net/',
    tag: 'Sheet',
    external: true,
  },
  {
    title: 'GitHub',
    description: 'Archipelago randomizers, Discord bots, minigames and more.',
    href: 'https://github.com/ChakraaThePanda',
    tag: 'Code',
    external: true,
  },
];

