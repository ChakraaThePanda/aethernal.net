// Fetches the Blizzard characters listed in src/data/characters.ts from the Battle.net API and
// writes src/data/generated/retail.json for the WoW page to render at build time.
//
// Needs BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET (GitHub Actions secrets in CI, or a local
// .env-style export when testing). Without them it writes nothing and the page shows a notice.
//
// The character list is parsed out of characters.ts rather than imported, so this runs on plain
// Node without a TypeScript loader.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);
const OUT_DIR = new URL('src/data/generated/', ROOT);
const OUT_FILE = new URL('retail.json', OUT_DIR);

const { BLIZZARD_CLIENT_ID: clientId, BLIZZARD_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.warn('BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET not set, skipping retail fetch.');
  process.exit(0);
}

async function loadCharacterList() {
  const src = await readFile(new URL('src/data/characters.ts', ROOT), 'utf8');
  const block = src.match(/blizzardCharacters[^=]*=\s*\[([\s\S]*?)\];/);
  if (!block) throw new Error('Could not find blizzardCharacters in characters.ts');
  const entries = [...block[1].matchAll(/\{([^}]*)\}/g)].map((m) => {
    const obj = {};
    for (const [, key, value] of m[1].matchAll(/(\w+):\s*'([^']*)'/g)) obj[key] = value;
    return obj;
  });
  return entries.filter((c) => c.name && c.realm);
}

async function getToken(region) {
  const res = await fetch(`https://oauth.battle.net/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Token request failed (${region}): ${res.status}`);
  return (await res.json()).access_token;
}

function makeApi(token, region, namespace) {
  return async (path) => {
    const url = `https://${region}.api.blizzard.com${path}?namespace=${namespace}&locale=en_US`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  };
}

const rgb = (c) => (c ? `rgb(${c.r}, ${c.g}, ${c.b})` : null);

function summarizeRaids(raids) {
  // Latest expansion's raids, newest first, keeping the highest-tier progress for each mode.
  const expansion = raids?.expansions?.at(-1);
  if (!expansion) return [];
  return expansion.instances
    .slice(-2)
    .reverse()
    .map((inst) => ({
      name: inst.instance.name,
      modes: inst.modes.map((m) => ({
        difficulty: m.difficulty.type, // LFR, NORMAL, HEROIC, MYTHIC
        label: m.difficulty.name,
        killed: m.progress.completed_count,
        total: m.progress.total_count,
      })),
    }));
}

async function fetchCharacter(api, c) {
  const base = `/profile/wow/character/${c.realm}/${c.name.toLowerCase()}`;
  const profile = await api(base);
  if (!profile) return { ...c, error: 'Character not found (it may need to log in once, or be level 10+).' };

  const settle = (p) => p.catch((err) => (console.warn(`  ${c.name}: ${err.message}`), null));
  const [media, equipment, keystone, raids] = await Promise.all([
    settle(api(`${base}/character-media`)),
    settle(api(`${base}/equipment`)),
    settle(api(`${base}/mythic-keystone-profile`)),
    settle(api(`${base}/encounters/raids`)),
  ]);
  const asset = (key) => media?.assets?.find((a) => a.key === key)?.value ?? null;

  return {
    name: profile.name,
    owner: c.owner,
    realm: profile.realm.name,
    region: c.region,
    level: profile.level,
    race: profile.race.name,
    className: profile.character_class.name,
    spec: profile.active_spec?.name ?? null,
    faction: profile.faction.name,
    guild: profile.guild?.name ?? null,
    itemLevel: profile.equipped_item_level ?? profile.average_item_level ?? null,
    achievementPoints: profile.achievement_points ?? null,
    lastLogin: profile.last_login_timestamp ?? null,
    avatar: asset('avatar'),
    inset: asset('inset'),
    render: asset('main-raw') ?? asset('main'),
    mythicRating: keystone?.current_mythic_rating
      ? { value: Math.round(keystone.current_mythic_rating.rating), color: rgb(keystone.current_mythic_rating.color) }
      : null,
    raids: summarizeRaids(raids),
    equipment: (equipment?.equipped_items ?? []).map((item) => ({
      slot: item.slot.name,
      name: item.name,
      id: item.item.id,
      quality: item.quality.type,
      itemLevel: item.level?.value ?? null,
    })),
    profileUrl: `https://worldofwarcraft.blizzard.com/en-${c.region}/character/${c.region}/${c.realm}/${c.name.toLowerCase()}`,
  };
}

const characters = await loadCharacterList();
const tokens = {};
const results = [];
for (const c of characters) {
  try {
    tokens[c.region] ??= await getToken(c.region);
    const api = makeApi(tokens[c.region], c.region, c.namespace || `profile-${c.region}`);
    console.log(`Fetching ${c.name}-${c.realm} (${c.namespace})`);
    results.push(await fetchCharacter(api, c));
  } catch (err) {
    console.warn(`  ${c.name}: ${err.message}`);
    results.push({ ...c, error: 'Could not reach the Battle.net API.' });
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), characters: results }, null, 2));
console.log(`Wrote ${results.length} character(s) to src/data/generated/retail.json`);
