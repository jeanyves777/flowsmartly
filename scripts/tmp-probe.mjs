import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://127.0.0.1:8093/pricing', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1000));
const o = await p.evaluate(() => {
  const all = [...document.querySelectorAll('*')];
  const sc = all.find((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4; });
  const wrap = sc.children[0];
  const footRegion = wrap.children[wrap.children.length - 1];
  const rows = [];
  const rec = (e, d) => {
    if (d > 3) return;
    const r = e.getBoundingClientRect();
    if (r.height < 24) return;
    rows.push('  '.repeat(d) + String(Math.round(r.height)).padStart(5) + 'px  ' +
      (e.textContent || '').trim().slice(0, 40));
    for (const c of e.children) rec(c, d + 1);
  };
  rec(footRegion, 0);
  return rows.slice(0, 34);
});
o.forEach((r) => console.log('  ' + r));
await b.close();
