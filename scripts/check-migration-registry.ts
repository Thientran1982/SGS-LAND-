/**
 * Verify that every numbered migration file is included in the production
 * runner registry. The registry is intentionally static because migrations
 * must also work when the server is bundled.
 *
 * Add a filename to INTENTIONALLY_EXCLUDED_MIGRATIONS only when it is
 * deliberately not a production migration, and document the reason here.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATION_REGISTRY } from '../server/migrations/runner';

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../server/migrations/', import.meta.url));
const NUMBERED_MIGRATION_PATTERN = /^\d{3}_.+\.ts$/;

// Keep this list empty unless a numbered file is intentionally excluded from
// production. Each exception must include its rationale in this comment.
const INTENTIONALLY_EXCLUDED_MIGRATIONS: ReadonlySet<string> = new Set([
  // '123_example.ts', // Reason: this file is a local-only development fixture.
]);

const migrationFiles = (await readdir(MIGRATIONS_DIRECTORY))
  .filter((filename) => NUMBERED_MIGRATION_PATTERN.test(filename))
  .sort();
const registeredFiles = Object.keys(MIGRATION_REGISTRY).sort();
const excludedFiles = [...INTENTIONALLY_EXCLUDED_MIGRATIONS].sort();

const fileSet = new Set(migrationFiles);
const registrySet = new Set(registeredFiles);
const excludedSet = new Set(excludedFiles);
const missingFromRegistry = migrationFiles.filter(
  (filename) => !registrySet.has(filename) && !excludedSet.has(filename),
);
const missingFromDirectory = registeredFiles.filter((filename) => !fileSet.has(filename));
const invalidExclusions = excludedFiles.filter((filename) => !fileSet.has(filename));
const excludedAndRegistered = excludedFiles.filter((filename) => registrySet.has(filename));

if (
  missingFromRegistry.length > 0 ||
  missingFromDirectory.length > 0 ||
  invalidExclusions.length > 0 ||
  excludedAndRegistered.length > 0
) {
  console.error('[migration-registry] Registry and migration directory are out of sync.');
  if (missingFromRegistry.length > 0) {
    console.error(`Missing registry entries: ${missingFromRegistry.join(', ')}`);
  }
  if (missingFromDirectory.length > 0) {
    console.error(`Registry entries missing files: ${missingFromDirectory.join(', ')}`);
  }
  if (invalidExclusions.length > 0) {
    console.error(`Excluded files do not exist: ${invalidExclusions.join(', ')}`);
  }
  if (excludedAndRegistered.length > 0) {
    console.error(`Files cannot be both excluded and registered: ${excludedAndRegistered.join(', ')}`);
  }
  process.exit(1);
}

console.log(
  `[migration-registry] OK: ${migrationFiles.length} numbered files, ` +
    `${registeredFiles.length} registered, ${excludedFiles.length} intentionally excluded.`,
);