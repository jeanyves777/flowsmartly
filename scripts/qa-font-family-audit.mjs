/**
 * Finds text style objects that set a size but no family.
 *
 * react-native-web writes its OWN font-family class onto every Text, so any
 * style object that declares fontSize without declaring fontFamily silently
 * renders in the platform fallback stack rather than the approved typeface.
 * The type scale carries the family, so `...ty.body` is fine; a hand-written
 * `{ fontSize: 15, fontWeight: '700' }` is not.
 *
 *   node scripts/qa-font-family-audit.mjs [--fix]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps/v5/src/components', 'apps/v5/src/app'];
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(String.fromCharCode(46)+"tsx") || p.endsWith(String.fromCharCode(46)+"ts")) out.push(p.split(String.fromCharCode(92)).join("/"));
  }
  return out;
};

/** Return [start,end] index of the object literal containing `at`. */
function enclosingObject(src, at) {
  let depth = 0, start = -1;
  for (let i = at; i >= 0; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return null;
  depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return [start, i + 1]; }
  }
  return null;
}

const hits = [];
for (const root of ROOTS) {
  for (const f of walk(root)) {
    const src = readFileSync(f, 'utf8');
    const re = /\bfontSize:/g; let m;
    while ((m = re.exec(src))) {
      const span = enclosingObject(src, m.index);
      if (!span) continue;
      const obj = src.slice(span[0], span[1]);
      if (/fontFamily/.test(obj)) continue;
      // spreading the scale brings the family with it
      if (/\.\.\.\s*(ty|type|typeScale|t)\./.test(obj)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      const size = (obj.match(/fontSize:\s*([^,\n]+)/) || [])[1] || '?';
      hits.push({ f, line, size: size.trim().slice(0, 18) });
    }
  }
}
const byFile = hits.reduce((a, h) => { (a[h.f] ||= []).push(h); return a; }, {});
console.log('  style objects with a size but NO family: ' + hits.length + '  in ' + Object.keys(byFile).length + ' files\n');
for (const [f, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
  console.log('  ' + String(list.length).padStart(3) + '  ' + f.replace('apps/v5/src/', ''));
  if (list.length <= 4) for (const h of list) console.log('       L' + h.line + '  fontSize: ' + h.size);
}
process.exit(hits.length ? 1 : 0);
