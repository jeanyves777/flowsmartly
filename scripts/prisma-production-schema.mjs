#!/usr/bin/env node
/**
 * Derive the PRODUCTION Prisma schema without editing tracked source.
 * ===================================================================
 *
 * THE PROBLEM THIS REPLACES. `scripts/deploy-vps.sh` used to run, on the live
 * server, against the checked-out working tree:
 *
 *     sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
 *
 * That is a deployment step that edits tracked source. Three consequences, all of
 * which have already cost us something:
 *
 *   1. The deployed tree is permanently dirty, so `git status` on the server can
 *      never distinguish "someone edited production" from "the deploy ran".
 *   2. Any build performed WITHOUT that sed silently produces a SQLite client.
 *      It type-checks, it builds, it starts, and then every database call fails
 *      at runtime with `the URL must start with the protocol file:`. That is
 *      exactly how the first staged release of the leads endpoint failed - the
 *      endpoint was correct and the client was built against the wrong provider.
 *   3. CI runs plain `npx prisma generate`, so CI has always generated a SQLite
 *      client and has never exercised the provider production actually uses.
 *
 * WHY NOT SIMPLY COMMIT provider = "postgresql". Because SQLite is not
 * vestigial - it is the local development database, and the application code is
 * written to accommodate both (see the `mode: "insensitive"` and JS-side
 * grouping workarounds across src/app/api). Flipping the committed default would
 * break every developer's machine to fix a deployment concern.
 *
 * WHY NOT COMMIT A SECOND FULL SCHEMA. prisma/schema.prisma is 6,542 lines. A
 * committed copy differing in one line is a drift bomb: the two will diverge, and
 * the divergence will be discovered in production. A DERIVED file cannot drift,
 * because it is regenerated from the single source of truth on every build.
 *
 * WHAT THIS DOES. Reads the tracked schema, changes ONLY the datasource
 * provider, writes the result to an untracked, gitignored path, and refuses to
 * proceed on anything it does not recognise. The tracked file is opened
 * read-only and is never written.
 *
 *     node scripts/prisma-production-schema.mjs            # derive
 *     npm run prisma:generate:prod                          # derive + generate
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'prisma', 'schema.prisma');
const OUT_DIR = join(ROOT, 'prisma', 'generated');
const OUT = join(OUT_DIR, 'schema.production.prisma');

const PROD_PROVIDER = 'postgresql';
const DEV_PROVIDER = 'sqlite';

function fail(message) {
  console.error(`prisma-production-schema: ${message}`);
  process.exit(1);
}

if (!existsSync(SOURCE)) fail(`source schema not found at ${SOURCE}`);
const source = readFileSync(SOURCE, 'utf8');

// Match the datasource block's provider specifically. A bare
// /provider = "sqlite"/ would also match a generator block, and silently
// rewriting the wrong provider is the class of bug this file exists to end.
const DATASOURCE = /(datasource\s+\w+\s*\{[^}]*?provider\s*=\s*")([^"]+)(")/;
const match = source.match(DATASOURCE);
if (!match) fail('no datasource block with a provider was found - refusing to guess');

const current = match[2];
if (current === PROD_PROVIDER) {
  console.log('prisma-production-schema: source is already postgresql; copying verbatim');
} else if (current !== DEV_PROVIDER) {
  fail(`datasource provider is "${current}", expected "${DEV_PROVIDER}" or "${PROD_PROVIDER}" - refusing to rewrite something unrecognised`);
}

const datasourceCount = (source.match(/^datasource\s+\w+\s*\{/gm) || []).length;
if (datasourceCount !== 1) fail(`expected exactly 1 datasource block, found ${datasourceCount}`);

const derived = source.replace(DATASOURCE, `$1${PROD_PROVIDER}$3`);

// The ONLY permitted difference is the provider token itself.
const normalise = (s) => s.replace(DATASOURCE, '$1<PROVIDER>$3');
if (normalise(source) !== normalise(derived)) {
  fail('the derivation changed something other than the datasource provider - refusing to emit');
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, derived, 'utf8');

// Prove the tracked source was not modified. Reading it back is cheap and turns
// "this script does not write the source" from a claim into a check.
if (readFileSync(SOURCE, 'utf8') !== source) fail('the tracked schema changed during derivation - aborting');

const lines = derived.split('\n').length;
console.log(`prisma-production-schema: wrote ${OUT}`);
console.log(`  provider  ${current} -> ${PROD_PROVIDER}   (datasource block only)`);
console.log(`  lines     ${lines}   tracked source unmodified`);
