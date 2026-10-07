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
  return async (path, ns = namespace) => {
    const url = `https://${region}.api.blizzard.com${path}?namespace=${ns}&locale=en_US`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  };
}

const rgb = (c) => (c ? `rgb(${c.r}, ${c.g}, ${c.b})` : null);

const DIFFICULTIES = ['LFR', 'NORMAL', 'HEROIC', 'MYTHIC'];

// The newest expansion's raids from the Encounter Journal, so raids nobody has set foot in still
// show (as 0/N) and a new expansion's raids appear on their own. Cached per region and namespace
// since it's the same for every character.
const journalCache = new Map();
function latestRaidTier(api, staticNs) {
  if (!journalCache.has(staticNs)) {
    journalCache.set(staticNs, (async () => {
      const index = await api('/data/wow/journal-expansion/index', staticNs);
      // The index also has a rolling "Current Season" tier; we want the newest real expansion.
      const tiers = (index?.tiers ?? []).filter((t) => !/current season/i.test(t.name));
      const newest = tiers.sort((a, b) => b.id - a.id)[0];
      if (!newest) return null;
      const expansion = await api(`/data/wow/journal-expansion/${newest.id}`, staticNs);
      // The journal files the expansion's world bosses as a "raid" named after the expansion.
      const realRaids = (expansion?.raids ?? []).filter((r) => r.name !== expansion.name);
      const raids = await Promise.all(realRaids.map(async (r) => {
        const inst = await api(`/data/wow/journal-instance/${r.id}`, staticNs);
        return {
          id: r.id,
          name: r.name,
          bosses: inst?.encounters?.length ?? 0,
          minimumLevel: inst?.minimum_level ?? 0,
          difficulties: (inst?.modes ?? []).map((m) => m.mode.type).filter((d) => DIFFICULTIES.includes(d)),
        };
      }));
      // The newest raids require the level cap, so their minimum level is the current max level.
      const maxLevel = Math.max(0, ...raids.map((r) => r.minimumLevel)) || null;
      return { expansion: expansion?.name ?? newest.name, maxLevel, raids: raids.reverse() }; // newest raid first
    })().catch((err) => (console.warn(`  journal: ${err.message}`), null)));
  }
  return journalCache.get(staticNs);
}

function buildRaids(tier, progress) {
  // Character progress keyed by journal instance id, across every expansion it has kills in.
  const byInstance = new Map();
  for (const exp of progress?.expansions ?? []) {
    for (const inst of exp.instances) byInstance.set(inst.instance.id, inst);
  }

  if (!tier) {
    // Journal unavailable: fall back to whatever the character's latest expansion shows.
    const exp = progress?.expansions?.at(-1);
    if (!exp) return null;
    tier = {
      expansion: exp.expansion.name,
      raids: exp.instances.map((i) => ({
        id: i.instance.id,
        name: i.instance.name,
        bosses: i.modes[0]?.progress.total_count ?? 0,
        difficulties: i.modes.map((m) => m.difficulty.type),
      })).reverse(),
    };
  }

  return {
    expansion: tier.expansion,
    raids: tier.raids.map((raid) => {
      const modes = byInstance.get(raid.id)?.modes ?? [];
      const difficulties = raid.difficulties.length ? raid.difficulties : DIFFICULTIES;
      return {
        name: raid.name,
        progress: DIFFICULTIES.filter((d) => difficulties.includes(d)).map((d) => {
          const m = modes.find((x) => x.difficulty.type === d);
          return {
            difficulty: d,
            killed: m?.progress.completed_count ?? 0,
            total: m?.progress.total_count ?? raid.bosses,
          };
        }),
      };
    }),
  };
}

function buildMythicPlus(keystone, season) {
  if (!keystone?.current_mythic_rating) return null;
  // Older seasons listed a Fortified and a Tyrannical run per dungeon; keep the better one.
  const best = new Map();
  for (const run of season?.best_runs ?? []) {
    const rating = run.map_rating ?? run.mythic_rating;
    const prev = best.get(run.dungeon.id);
    if (!prev || (rating?.rating ?? 0) > prev.rating) {
      best.set(run.dungeon.id, {
        dungeon: run.dungeon.name,
        level: run.keystone_level,
        timed: run.is_completed_within_time,
        rating: Math.round(rating?.rating ?? 0),
        color: rgb(rating?.color),
      });
    }
  }
  return {
    value: Math.round(keystone.current_mythic_rating.rating),
    color: rgb(keystone.current_mythic_rating.color),
    runs: [...best.values()].sort((a, b) => b.rating - a.rating),
  };
}

async function fetchCharacter(api, c) {
  const base = `/profile/wow/character/${c.realm}/${c.name.toLowerCase()}`;
  const profile = await api(base);
  if (!profile) return { ...c, error: 'Character not found (it may need to log in once, or be level 10+).' };

  const settle = (p) => p.catch((err) => (console.warn(`  ${c.name}: ${err.message}`), null));
  const staticNs = (c.namespace || `profile-${c.region}`).replace(/^profile-/, 'static-');
  const [media, equipment, keystone, raids, tier] = await Promise.all([
    settle(api(`${base}/character-media`)),
    settle(api(`${base}/equipment`)),
    settle(api(`${base}/mythic-keystone-profile`)),
    settle(api(`${base}/encounters/raids`)),
    latestRaidTier(api, staticNs),
  ]);
  // Per-dungeon best runs live on the season endpoint; the newest season is the current one.
  const seasonId = keystone?.seasons?.map((s) => s.id).sort((a, b) => b - a)[0];
  const season = seasonId ? await settle(api(`${base}/mythic-keystone-profile/season/${seasonId}`)) : null;
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
    lastLogin: profile.last_login_timestamp ?? null,
    avatar: asset('avatar'),
    inset: asset('inset'),
    render: asset('main-raw') ?? asset('main'),
    maxLevel: tier?.maxLevel ?? null,
    mythicPlus: buildMythicPlus(keystone, season),
    raids: buildRaids(tier, raids),
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
