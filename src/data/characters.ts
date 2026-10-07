// Characters tracked on the WoW page.
//
// Retail (and later WoW Forever / Classic) characters are fetched from the Battle.net API by
// scripts/fetch-retail.mjs during each deploy. `namespace` is the Battle.net profile namespace:
// 'profile-us' for retail, 'profile-classic-us' / 'profile-classic1x-us' for Classic flavors.
export interface BlizzardCharacter {
  name: string;
  realm: string; // realm slug, e.g. 'stormrage'
  region: 'us' | 'eu';
  namespace: string;
  owner: string;
}

export const blizzardCharacters: BlizzardCharacter[] = [
  { name: 'chakraa', realm: 'stormrage', region: 'us', namespace: 'profile-us', owner: 'Pat' },
  { name: 'melodie', realm: 'frostwolf', region: 'us', namespace: 'profile-us', owner: 'Mimi' },
];

// Aethernal characters are fetched live in the browser from the account panel's public API.
// The server only answers for names in its own PUBLIC_CHARACTERS allowlist.
export const aethernalApi = 'https://wow.aethernal.net/api/public/characters';
export const aethernalCharacters: { name: string; owner: string }[] = [
  { name: 'Fish', owner: '' },
  { name: 'Croustille', owner: '' },
];
