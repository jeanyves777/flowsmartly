/**
 * Proves the contrast gate can still fail.
 *
 * A gate that reports zero is indistinguishable from a gate that has stopped
 * working, and this one has been wrong in both directions already: it once
 * invented ratios by scoring hero copy against the page behind a photograph,
 * and it once refused to score photographs at all. Both states reported
 * confidently. So the gate is now checked against two fixtures whose answers
 * are known before it runs:
 *
 *   weak.html    white text over a photo behind a 0.15 scrim  -> MUST FAIL
 *   strong.html  the same text behind a 0.86 scrim            -> MUST PASS
 *
 * If the weak fixture ever passes, the gate is broken and every green run it
 * has produced is worthless. That is worth one second of CI.
 *
 *   node scripts/qa-selftest-contrast.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const DIR = 'qa-fixtures';
const PORT = 8097;
mkdirSync(DIR, { recursive: true });

const photo =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800">' +
      '<rect width="400" height="800" fill="#888"/></svg>',
  ).toString('base64');

const page = (veil) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>fixture</title></head>' +
  '<body style="margin:0;background:#fff">' +
  '<div style="position:relative;height:800px;overflow:auto">' +
  '<div style="position:relative;height:1400px">' +
  '<img src="' + photo + '" alt="" style="position:absolute;inset:0;width:100%;height:100%">' +
  '<div style="position:absolute;inset:0;background:rgba(0,0,0,' + veil + ')"></div>' +
  '<div style="position:relative;padding:40px">' +
  '<h1 style="color:#fff;font:700 34px system-ui;margin:0 0 16px">Heading over the photograph</h1>' +
  '<p style="color:#fff;font:400 17px/1.6 system-ui;margin:0">Body copy sitting directly on the image.</p>' +
  '</div></div></div></body></html>';

writeFileSync(DIR + '/weak.html', page(0.15));
writeFileSync(DIR + '/strong.html', page(0.86));

const run = (cmd, args) =>
  new Promise((resolve) => {
    // shell:false deliberately. process.execPath is "C:\Program Files\nodejs\
    // node.exe" - with a shell the args are concatenated unquoted, the command
    // splits at the space, nothing runs, and the self-test reports the gate
    // broken when the only broken thing was how it invoked the gate.
    const p = spawn(cmd, args, { shell: false });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });

const server = spawn(process.execPath, ['scripts/qa-serve.mjs', DIR, String(PORT)], { shell: false });
await new Promise((r) => setTimeout(r, 1500));

const audit = (route) =>
  run(process.execPath, [
    'scripts/qa-typography-audit.mjs',
    '--base', 'http://127.0.0.1:' + PORT,
    '--routes', route,
    '--width', '390',
  ]);

const weak = await audit('/weak.html');
const strong = await audit('/strong.html');
server.kill();

const contrastCount = (out) => {
  const m = out.match(/contrast\s+(\d+)/);
  return m ? Number(m[1]) : -1;
};
const scoredOverPhoto = (out) => /scored against a GUARANTEED bound/.test(out);

const results = [];
const weakN = contrastCount(weak.out);
const strongN = contrastCount(strong.out);

results.push({
  name: 'weak 0.15 scrim must FAIL',
  ok: weakN > 0,
  detail: 'contrast findings = ' + weakN + (weakN > 0 ? '' : '  <-- THE GATE HAS STOPPED DETECTING'),
});
results.push({
  name: 'strong 0.86 scrim must PASS',
  ok: strongN === 0,
  detail: 'contrast findings = ' + strongN + (strongN === 0 ? '' : '  <-- the gate now rejects a legible scrim'),
});
results.push({
  name: 'both must be scored against the bound, not skipped',
  ok: scoredOverPhoto(weak.out) && scoredOverPhoto(strong.out),
  detail: 'weak=' + scoredOverPhoto(weak.out) + ' strong=' + scoredOverPhoto(strong.out),
});

console.log('=== contrast gate self-test ===');
for (const r of results) {
  console.log('  ' + (r.ok ? 'PASS  ' : 'FAIL  ') + r.name.padEnd(46) + r.detail);
}
const failed = results.filter((r) => !r.ok).length;
console.log('\n  ' + (failed ? failed + ' self-test failure(s) - the contrast gate cannot be trusted' : 'the contrast gate detects what it claims to detect'));
process.exit(failed ? 1 : 0);
