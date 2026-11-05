// Characters tracked on the WoW page.
//
// Retail (and later WoW Forever / Classic) characters are fetched from the Battle.net API by
// scripts/fetch-retail.mjs during each deploy. `namespace` is the Battle.net profile namespace:
// 'profile-us' for retail, 'profile-classic-us' / 'profile-classic1x-us' for Classic flavors.
// `game` picks the section the card shows in on the WoW page; it defaults to 'retail'.
export type BlizzardGame = 'retail' | 'forever';

export const GAME_LABELS: Record<BlizzardGame, string> = { retail: 'Retail', forever: 'Forever' };

export interface BlizzardCharacter {
  name: string;
  realm?: string; // realm slug, e.g. 'stormrage'; Forever has no realms, so leave it out there
  region: 'us' | 'eu';
  namespace: string;
  owner: string;
  game?: BlizzardGame;
  // Forever has no servers, just region-wide rulesets, shown on the card in place of the realm.
  // The fetched profile carries the real ruleset; this is only the fallback label.
  ruleset?: string;
}

export const blizzardCharacters: BlizzardCharacter[] = [
  { name: 'chakraa', realm: 'stormrage', region: 'us', namespace: 'profile-us', owner: 'Pat' },
  { name: 'clo', realm: 'stormrage', region: 'us', namespace: 'profile-us', owner: 'Pat' },
  { name: 'connard', realm: 'stormrage', region: 'us', namespace: 'profile-us', owner: 'Pat' },
  // WoW Forever: first + last names, no realms. The API looks characters up by region and a
  // hyphenated slug of the full name: /profile/wow/character/monsieur-fish?namespace=profile-forever-us
  { name: 'Chakraa Arcana', region: 'us', namespace: 'profile-forever-us', owner: 'Pat', game: 'forever', ruleset: 'Normal' },
  { name: 'Monsieur Fish', region: 'us', namespace: 'profile-forever-us', owner: 'Pat', game: 'forever', ruleset: 'Normal' },
  { name: 'Madame Chips', region: 'us', namespace: 'profile-forever-us', owner: 'Mimi', game: 'forever', ruleset: 'Normal' },
];

// Aethernal characters are fetched live in the browser from the account panel's public API.
// Which characters appear (and their owners) is set on the server: PUBLIC_CHARACTERS in the
// AzerothCore docker-compose.override.yml, as Name:Owner pairs.
export const aethernalApi = 'https://wow.aethernal.net/api/public/characters';
