/**
 * Hard release gate: no V5 public route may send a customer to a waitlist.
 * The V5 portal's /login and /register are live product routes, served by nginx
 * rather than the separate Expo marketing export. The old /early-access URL
 * exists only as a compatibility redirect to registration.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'src');
const forbidden = /\bjoin(?: v5)? early access\b|legacy\.flowsmartly\.com/i;
const suffixes = new Set(['.ts', '.tsx', '.js', '.jsx']);
const faults = [];

async function scan(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!item.isFile() || ![...suffixes].some((suffix) => item.name.endsWith(suffix))) {
      continue;
    }
    const source = await readFile(path, 'utf8');
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (forbidden.test(lines[index])) {
        faults.push(`${relative(root, path)}:${index + 1}`);
      }
    }
  }
}

await scan(root);

if (faults.length > 0) {
  console.error(
    'V5 account-entry release gate refused stale waitlist language:\n' +
      faults.map((row) => `  ${row}`).join('\n'),
  );
  process.exitCode = 1;
} else {
  console.log('V5 account-entry gate passed: no early-access signup promises');
}
