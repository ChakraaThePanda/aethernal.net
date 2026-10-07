import { existsSync, readFileSync } from 'node:fs';

// Written by scripts/fetch-retail.mjs during the deploy workflow; missing when running locally
// without Battle.net credentials. Resolved from the project root because import.meta.url points
// into the build output once Astro bundles a page.
const RETAIL_FILE = `${process.cwd()}/src/data/generated/retail.json`;

export function loadRetail(): { characters: any[] } | null {
  return existsSync(RETAIL_FILE) ? JSON.parse(readFileSync(RETAIL_FILE, 'utf8')) : null;
}
