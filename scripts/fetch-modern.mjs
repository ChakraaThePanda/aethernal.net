// Fetches the Blizzard characters listed in src/data/characters.ts from the Battle.net API and
// writes src/data/generated/modern.json for the WoW page to render at build time.
//
// Needs BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET (GitHub Actions secrets in CI, or a local
// .env file). Without them it writes nothing and the page shows a notice.
//
// The character list is parsed out of characters.ts rather than imported, so this runs on plain
// Node without a TypeScript loader.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { measureRender } from './render-figure.mjs';

const ROOT = new URL('..', import.meta.url);
const OUT_DIR = new URL('src/data/generated/', ROOT);
const OUT_FILE = new URL('modern.json', OUT_DIR);

const { BLIZZARD_CLIENT_ID: clientId, BLIZZARD_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.warn('BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET not set, skipping modern fetch.');
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
  return entries
    .map((c) => ({ game: 'modern', ...c }))
    .filter((c) => c.name && (c.realm || c.game === 'forever'));
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

// The current Mythic+ season from the game data API (dynamic namespace), so the label follows
// new seasons on its own. Cached per namespace since it's the same for every character.
const seasonCache = new Map();
function currentKeystoneSeason(api, dynamicNs) {
  if (!seasonCache.has(dynamicNs)) {
    seasonCache.set(dynamicNs, (async () => {
      const index = await api('/data/wow/mythic-keystone/season/index', dynamicNs);
      const id = index?.current_season?.id;
      if (!id) return null;
      // The season itself doesn't list its dungeons, but each connected realm has one current
      // leaderboard per dungeon in the rotation, so any realm's leaderboard index gives the list.
      const [season, realms] = await Promise.all([
        api(`/data/wow/mythic-keystone/season/${id}`, dynamicNs),
        api('/data/wow/connected-realm/index', dynamicNs).catch(() => null),
      ]);
      const realmId = realms?.connected_realms?.[0]?.href?.match(/connected-realm\/(\d+)/)?.[1];
      const boards = realmId
        ? await api(`/data/wow/connected-realm/${realmId}/mythic-leaderboard/index`, dynamicNs).catch(() => null)
        : null;
      const dungeons = (boards?.current_leaderboards ?? []).map((b) => ({ id: b.id, name: b.name }));
      // Blizzard names it 'Mythic+ Dungeons (Midnight Season 2)'; the card only wants 'Midnight Season 2'.
      const raw = season?.season_name ?? '';
      const name = (raw.match(/\(([^)]+)\)/)?.[1] ?? raw.replace(/^mythic\+?\s*(dungeons)?\s*[:-]?\s*/i, '')).trim() || null;
      return { id, name, dungeons };
    })().catch((err) => (console.warn(`  keystone season: ${err.message}`), null)));
  }
  return seasonCache.get(dynamicNs);
}

// Primary professions, then secondary ones (Cooking, Fishing, ...). Modern splits each profession
// into one skill line per expansion, so it shows the newest tier the character has; Classic-style
// profiles (Forever) put the skill on the profession itself.
function buildProfessions(data) {
  const entry = (p, secondary) => {
    const tier = [...(p.tiers ?? [])].sort((a, b) => (b.tier?.id ?? 0) - (a.tier?.id ?? 0))[0];
    const skill = tier?.skill_points ?? p.skill_points;
    if (skill == null) return null;
    return {
      name: p.profession.name,
      tier: tier?.tier?.name ?? null,
      skill,
      max: tier?.max_skill_points ?? p.max_skill_points ?? null,
      secondary,
    };
  };
  const byName = (a, b) => a.name.localeCompare(b.name);
  const list = [
    ...(data?.primaries ?? []).map((p) => entry(p, false)).filter(Boolean).sort(byName),
    ...(data?.secondaries ?? []).map((p) => entry(p, true)).filter(Boolean).sort(byName),
  ];
  return list.length ? list : null;
}

function buildMythicPlus(keystone, season, current) {
  const rotation = current?.dungeons ?? [];
  if (!keystone?.current_mythic_rating && !rotation.length) return null;
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
    season: current?.name ?? null,
    value: keystone?.current_mythic_rating ? Math.round(keystone.current_mythic_rating.rating) : null,
    color: rgb(keystone?.current_mythic_rating?.color),
    // Every dungeon in this season's rotation, best runs first, then the ones not done yet
    // (level null) by name. Without a rotation, just the dungeons the character has run.
    runs: [
      ...[...best.values()].sort((a, b) => b.rating - a.rating),
      ...rotation.filter((d) => !best.has(d.id))
        .map((d) => ({ dungeon: d.name, level: null, timed: false, rating: null, color: null }))
        .sort((a, b) => a.dungeon.localeCompare(b.dungeon)),
    ],
  };
}

// Modern characters live at /{realm}/{name}. Forever has no realms: the path is just a slug of
// the full name, spaces turned into hyphens ('Monsieur Fish' -> 'monsieur-fish').
const characterSlug = (name) => encodeURIComponent(name.toLowerCase().trim().replace(/\s+/g, '-'));

function armoryUrl(c) {
  const slug = characterSlug(c.name);
  return c.game === 'forever'
    ? `https://worldofwarcraft.blizzard.com/en-${c.region}/forever/${c.region}/armory/character/${slug}`
    : `https://worldofwarcraft.blizzard.com/en-${c.region}/character/${c.region}/${c.realm}/${slug}`;
}

async function fetchCharacter(api, c) {
  const base = `/profile/wow/character/${c.realm ? `${c.realm}/` : ''}${characterSlug(c.name)}`;
  const profile = await api(base);
  if (!profile) return { ...c, error: 'Character not found (it may need to log in once, or be level 10+).' };

  const settle = (p) => p.catch((err) => (console.warn(`  ${c.name}: ${err.message}`), null));
  const staticNs = (c.namespace || `profile-${c.region}`).replace(/^profile-/, 'static-');
  const dynamicNs = staticNs.replace(/^static-/, 'dynamic-');
  const [media, equipment, keystone, raids, tier, specs, currentSeason, professions] = await Promise.all([
    settle(api(`${base}/character-media`)),
    settle(api(`${base}/equipment`)),
    settle(api(`${base}/mythic-keystone-profile`)),
    settle(api(`${base}/encounters/raids`)),
    latestRaidTier(api, staticNs),
    // Forever profiles have no active_spec; the active one is on the specializations endpoint.
    profile.active_spec ? null : settle(api(`${base}/specializations`)),
    currentKeystoneSeason(api, dynamicNs),
    settle(api(`${base}/professions`)),
  ]);
  const activeSpec = profile.active_spec?.name
    ?? specs?.specialization_groups?.find((g) => g.is_active)?.specializations?.[0]?.specialization?.name
    ?? null;
  // Per-dungeon best runs live on the season endpoint. Use the current season when the game data
  // API gives it (no runs there yet means none this season), else the character's newest season.
  const seasonId = currentSeason?.id ?? keystone?.seasons?.map((s) => s.id).sort((a, b) => b - a)[0];
  const season = seasonId ? await settle(api(`${base}/mythic-keystone-profile/season/${seasonId}`)) : null;
  const asset = (key) => media?.assets?.find((a) => a.key === key)?.value ?? null;
  const render = asset('main-raw') ?? asset('main');
  const figure = await settle(measureRender(render));

  return {
    // Forever splits the name: name is the first name, surname the last.
    name: [profile.name, profile.surname].filter(Boolean).join(' '),
    owner: c.owner,
    game: c.game || 'modern',
    realm: profile.realm?.name ?? null,
    ruleset: profile.ruleset?.name ?? c.ruleset ?? null,
    level: profile.level,
    race: profile.race.name,
    gender: profile.gender?.name ?? null, // for the race icon when there's no avatar
    className: profile.character_class.name,
    spec: activeSpec,
    guild: profile.guild?.name ?? null,
    itemLevel: profile.equipped_item_level ?? profile.average_item_level ?? null,
    lastLogin: profile.last_login_timestamp ?? null,
    avatar: asset('avatar'),
    render,
    figure, // where the character stands in the render, for the card (see render-figure.mjs)
    maxLevel: tier?.maxLevel ?? null,
    mythicPlus: buildMythicPlus(keystone, season, currentSeason),
    raids: buildRaids(tier, raids),
    equipment: (equipment?.equipped_items ?? []).map((item) => ({
      slot: item.slot.name,
      name: item.name,
      id: item.item.id,
      quality: item.quality.type,
      itemLevel: item.level?.value ?? null,
    })),
    professions: buildProfessions(professions),
    profileUrl: armoryUrl(c),
  };
}

const characters = await loadCharacterList();
const tokens = {};
const results = [];
for (const c of characters) {
  try {
    tokens[c.region] ??= await getToken(c.region);
    const api = makeApi(tokens[c.region], c.region, c.namespace || `profile-${c.region}`);
    console.log(`Fetching ${c.name}${c.realm ? `-${c.realm}` : ''} (${c.namespace})`);
    results.push(await fetchCharacter(api, c));
  } catch (err) {
    console.warn(`  ${c.name}: ${err.message}`);
    results.push({ ...c, error: 'Could not reach the Battle.net API.' });
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, JSON.stringify({ characters: results }, null, 2));
console.log(`Wrote ${results.length} character(s) to src/data/generated/modern.json`);
