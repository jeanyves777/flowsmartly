import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844 });
const ROUTES = ['/', '/product', '/pricing', '/company/about', '/legal/terms'];
const agg = new Map();
const offenders = new Map();
for (const r of ROUTES) {
  await p.goto('http://127.0.0.1:8093' + r, { waitUntil: 'networkidle2' });
  await new Promise((s) => setTimeout(s, 900));
  const d = await p.evaluate(() => {
    const fams = {}; const bad = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = w.nextNode())) {
      const direct = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!direct) continue;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const f = cs.fontFamily.split(',')[0].replace(/["']/g, '');
      fams[f] = (fams[f] || 0) + 1;
      if (!/Jakarta|FontAwesome/.test(f)) bad.push(f + ' :: ' + (n.textContent || '').trim().slice(0, 34));
    }
    return { fams, bad, loaded: document.fonts ? [...document.fonts].map((x) => x.family + ' ' + x.status).join('|') : '' };
  });
  for (const [k, v] of Object.entries(d.fams)) agg.set(k, (agg.get(k) || 0) + v);
  for (const s of d.bad) offenders.set(s, (offenders.get(s) || 0) + 1);
  if (r === '/') console.log('  document.fonts: ' + d.loaded.slice(0, 120));
}
await b.close();
const tot = [...agg.values()].reduce((a, c) => a + c, 0);
const jak = [...agg].filter(([k]) => /Jakarta/.test(k)).reduce((a, [, v]) => a + v, 0);
const ico = [...agg].filter(([k]) => /FontAwesome/.test(k)).reduce((a, [, v]) => a + v, 0);
console.log('\n  text nodes measured : ' + tot);
console.log('  Plus Jakarta Sans   : ' + jak + '  (' + ((jak / (tot - ico)) * 100).toFixed(1) + '% of non-icon)');
console.log('  icon glyphs         : ' + ico);
console.log('  OTHER (defect)      : ' + (tot - jak - ico));
if (offenders.size) {
  console.log('\n  residual, by node:');
  for (const [s, c] of [...offenders].sort((a, b2) => b2[1] - a[1]).slice(0, 14)) console.log('    x' + c + '  ' + s);
}
