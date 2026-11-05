import { existsSync, readFileSync } from 'node:fs';

// Written by scripts/fetch-modern.mjs during the deploy workflow; missing when running locally
// without Battle.net credentials. Resolved from the project root because import.meta.url points
// into the build output once Astro bundles a page.
const MODERN_FILE = `${process.cwd()}/src/data/generated/modern.json`;

export function loadModern(): { characters: any[] } | null {
  return existsSync(MODERN_FILE) ? JSON.parse(readFileSync(MODERN_FILE, 'utf8')) : null;
}
