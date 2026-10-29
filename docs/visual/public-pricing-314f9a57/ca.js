const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [port, tag] of [[8094, 'base'], [8092, 'cand']]) for (const w of [390, 768, 1024, 1280, 1536, 1920]) {
    const p = await b.newPage({ viewport: { width: w, height: 1000 }, reducedMotion: 'reduce' });
    await p.goto(`http://localhost:${port}/solutions/custom-automation/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.evaluate(() => { const bt = [...document.querySelectorAll('[role=button],button')].find((e) => /^Reject( optional)?$/.test(e.innerText.trim())); if (bt) bt.click(); });
    let r = null;
    for (let i = 0; i < 40 && !r; i++) {
      r = await p.evaluate(() => {
        const el = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'per month');
        if (!el) { const sc = [...document.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 10).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement; sc.scrollTop += 600; return null; }
        const strip = el.parentElement.parentElement; const card = strip.lastElementChild;
        strip.scrollIntoView({ block: 'center' });
        const cards = [...strip.children].map((c) => { const q = c.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), t: c.innerText.replace(/\n/g, ' | ') }; });
        const words = [...card.querySelectorAll('*')].filter((d) => d.childElementCount === 0).map((d) => { const rg = document.createRange(); rg.selectNodeContents(d); return { t: d.textContent, lines: new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size }; });
        return { cards, words };
      });
      if (!r) await p.waitForTimeout(250);
    }
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${process.argv[2]}/custom-automation-${w}-light-strip-${tag}.jpg`, type: 'jpeg', quality: 72 });
    out[`${tag}-${w}`] = r; await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
