/**
 * Derive the PostgreSQL schema the proofs run against from the SHIPPING one.
 *
 * `scripts/deploy-vps.sh` builds production by patching exactly one token in
 * `prisma/schema.prisma` — `provider = "sqlite"` -> `provider = "postgresql"`. This
 * does the same patch and nothing else, so the tables the proofs execute against are
 * the tables production gets. A hand-written proof schema would be a second statement
 * of the data model, and the direction it fails in is the one where the proof passes
 * against a shape production never had.
 *
 * The generator output is redirected so the PostgreSQL client does not overwrite the
 * app's SQLite one in `node_modules/.prisma/client`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const PG_DIR = join(here, '.pg');
export const PG_SCHEMA = join(PG_DIR, 'schema.prisma');
export const PG_CLIENT_DIR = join(PG_DIR, 'client');

export function derivePgSchema() {
  const source = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
  if (!source.includes('provider = "sqlite"')) {
    throw new Error(
      'prisma/schema.prisma no longer declares provider = "sqlite". The proof schema is ' +
        'derived by patching exactly that token, the way scripts/deploy-vps.sh does, and a ' +
        'derivation that silently found nothing to patch would run the proofs against a ' +
        'schema nobody checked.',
    );
  }
  const patched = source
    .replace('provider = "sqlite"', 'provider = "postgresql"')
    .replace(
      'generator client {\n  provider = "prisma-client-js"\n}',
      `generator client {\n  provider = "prisma-client-js"\n  output   = "${PG_CLIENT_DIR.split(sep).join('/')}"\n}`,
    )
    .replace(
      'generator client {\r\n  provider = "prisma-client-js"\r\n}',
      `generator client {\r\n  provider = "prisma-client-js"\r\n  output   = "${PG_CLIENT_DIR.split(sep).join('/')}"\r\n}`,
    );
  if (!patched.includes('output')) {
    throw new Error('the generator block was not rewritten; the proof client would overwrite the app client');
  }
  mkdirSync(PG_DIR, { recursive: true });
  writeFileSync(PG_SCHEMA, patched, 'utf8');
  return PG_SCHEMA;
}
