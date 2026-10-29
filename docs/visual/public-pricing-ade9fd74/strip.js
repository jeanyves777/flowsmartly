// Usage: node strip.js <outDir> <port>:<tag> [<port>:<tag> ...]
// Shoots /solutions/custom-automation plan strip at 6 widths x light/dark and measures
// per-word line splits (Range client rects), horizontal overflow and clipping.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const TREES = process.argv.slice(3).map((s) => s.split(':'));
const WIDTHS = [390, 768, 1024, 1280, 1536, 1920];
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [port, tag] of TREES) for (const theme of ['light', 'dark']) for (const w of WIDTHS) {
    const h = w === 390 ? 844 : w === 768 ? 1024 : 1000;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('v5:theme', t); } catch {} }, theme);
    const p = await ctx.newPage(); const errors = [];
    p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await p.goto(`http://localhost:${port}/solutions/custom-automation/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.evaluate(() => { const bt = [...document.querySelectorAll('[role=button],button')].find((e) => /^Reject( optional)?$/.test(e.innerText.trim())); if (bt) bt.click(); });
    await p.waitForTimeout(400);
    let r = null;
    for (let i = 0; i < 40 && !r; i++) {
      r = await p.evaluate(() => {
        const label = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Custom AI Automation');
        if (!label || !label.getClientRects().length) { const sc = [...document.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 10).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement; sc.scrollTop += 600; return null; }
        const tileC = label.parentElement; const strip = tileC.parentElement;
        strip.scrollIntoView({ block: 'center' });
        const sr = strip.getBoundingClientRect(); const pr = strip.parentElement.getBoundingClientRect();
        const tiles = [...strip.children].map((tile) => {
          const tr = tile.getBoundingClientRect(); const words = []; const clipped = [];
          const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
          let n; while ((n = walker.nextNode())) {
            const re = /\S+/g; let m;
            while ((m = re.exec(n.data))) {
              const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
              const rects = [...rg.getClientRects()].filter((x) => x.width > 0);
              const tops = [...new Set(rects.map((x) => Math.round(x.top)))];
              const bb = rg.getBoundingClientRect();
              const outside = bb.left < tr.left - 0.5 || bb.right > tr.right + 0.5 || bb.top < tr.top - 0.5 || bb.bottom > tr.bottom + 0.5;
              words.push({ word: m[0], rects: rects.length, lines: tops.length, split: tops.length > 1, outsideTile: outside });
            }
          }
          tile.querySelectorAll('*').forEach((e) => {
            const s = getComputedStyle(e);
            const clamps = s.overflow === 'hidden' || s.overflowX === 'hidden' || s.webkitLineClamp !== 'none' || s.textOverflow === 'ellipsis';
            if (clamps && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) clipped.push(e.textContent.trim().slice(0, 40));
          });
          return { text: tile.innerText.replace(/\n/g, ' | '), x: Math.round(tr.left), y: Math.round(tr.top), w: Math.round(tr.width), h: Math.round(tr.height), words, clipped };
        });
        const sc = [...document.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 10).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        return {
          strip: { x: Math.round(sr.left), y: Math.round(sr.top), w: Math.round(sr.width), h: Math.round(sr.height), rightOfParent: Math.round(sr.right - pr.right) },
          rows: [...new Set(tiles.map((t) => t.y))].length, tiles,
          overflow: { doc: document.documentElement.scrollWidth - window.innerWidth, scroller: sc ? sc.scrollWidth - sc.clientWidth : 0 },
          tileOutsideStrip: tiles.some((t) => t.x < sr.left - 0.5 || t.x + t.w > sr.right + 0.5),
          themeLabel: (document.querySelector('[aria-label^="Theme:"]') || { getAttribute: () => null }).getAttribute('aria-label'),
        };
      });
      if (!r) await p.waitForTimeout(250);
    }
    await p.waitForTimeout(900);
    const name = `custom-automation-${w}-${theme}`;
    await p.screenshot({ path: `${OUT}/${tag}/${name}-plan-strip.jpg`, type: 'jpeg', quality: 75 });
    if (r) { const s = r.strip; const vp = p.viewportSize();
      const clip = { x: Math.max(0, s.x - 16), y: Math.max(0, s.y - 16) }; clip.width = Math.min(vp.width - clip.x, s.w + 32); clip.height = Math.min(vp.height - clip.y, s.h + 32);
      await p.screenshot({ path: `${OUT}/${tag}/${name}-plan-strip-zoom.png`, clip }); }
    r && (r.errors = errors);
    out[`${tag}-${theme}-${w}`] = r; await ctx.close();
  }
  fs.writeFileSync(`${OUT}/strip-measurements.json`, JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) {
    if (!v) { console.log(k, 'NOT FOUND'); continue; }
    const split = v.tiles.flatMap((t) => t.words.filter((x) => x.split).map((x) => x.word));
    const outside = v.tiles.flatMap((t) => t.words.filter((x) => x.outsideTile).map((x) => x.word));
    const clipped = v.tiles.flatMap((t) => t.clipped);
    const wc = v.tiles.reduce((a, t) => a + t.words.length, 0);
    console.log(k.padEnd(18), `theme=${v.themeLabel} rows=${v.rows} tiles=${v.tiles.map((t) => t.w + 'x' + t.h).join(',')} words=${wc} split=[${split}] outside=[${outside}] clipped=[${clipped}] ovf=${v.overflow.doc}/${v.overflow.scroller} stripR=${v.strip.rightOfParent} tileOut=${v.tileOutsideStrip} err=${v.errors.length}`);
  }
  await b.close();
})();
