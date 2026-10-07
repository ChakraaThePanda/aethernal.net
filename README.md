# aethernal.net

Personal site: links to our projects, MTG decks, and live World of Warcraft
character profiles. Built with [Astro](https://astro.build) and deployed to GitHub Pages.

## Editing content

Everything you'd normally change lives in `src/data/`:

| File | What it controls |
| --- | --- |
| `links.ts` | Home page cards |
| `decks.ts` | MTG decks per player (Archidekt ids; art is fetched automatically) |
| `characters.ts` | Tracked WoW characters, retail and Aethernal |

Push to `main` and the site redeploys in a minute or two.

## Character widgets

- **Retail / Classic:** `scripts/fetch-retail.mjs` calls the Battle.net API during each deploy
  and the WoW page renders the result. The deploy also runs hourly so data stays fresh.
  Needs the `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` repository secrets.
- **Aethernal:** fetched live in the browser from `wow.aethernal.net/api/public/characters`,
  served by the account panel on the WoW server. That server only returns characters in its
  `PUBLIC_CHARACTERS` allowlist, so adding one here also means adding it there.

## Local development

```sh
npm install
npm run dev          # http://localhost:4321
```

To test the retail widget locally, copy `.env.example` to `.env` (git-ignored), fill in the
Battle.net credentials, and run `npm run fetch:retail` once before `npm run dev`. Re-run it
whenever you want fresh character data.

## License

Copyright (c) 2026 ChakraaThePanda. All rights reserved. This repository is public for
reference only; the code, the Aethernal logo and banner, and the site content may not be reused
without permission.
