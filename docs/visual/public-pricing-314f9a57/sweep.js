const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'http://localhost:8092';
const WIDTHS = [390, 768, 1024, 1280, 1536, 1920];
const THEMES = ['light', 'grey', 'dark'];
const CREDIT_TEXTS = ['No monthly credit allocation', '500 credits each month', '1,500 credits each month'];
fs.mkdirSync(OUT, { recursive: true });

async function scroller(page) {
  return page.evaluateHandle(() => {
    const all = [...document.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e);
      return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 10;
    });
    all.sort((a, b) => b.scrollHeight - a.scrollHeight);
    return all[0] || document.scrollingElement;
  });
}

async function scrollToText(page, text) {
  const sc = await scroller(page);
  await page.evaluate(([sc, text]) => {
    const el = [...document.querySelectorAll('div,span,h1,h2,h3')].find((e) => e.childElementCount === 0 && e.textContent.trim() === text);
    if (!el) return false;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTop = Math.max(0, top - 260);
    return true;
  }, [sc, text]);
  await page.waitForTimeout(1600);
}

// Inspect the three plan cards in whatever pricing block is anchored by the credit captions.
async function inspectCards(page) {
  return page.evaluate((CREDIT_TEXTS) => {
    const res = [];
    // Collect every caption instance and group per block (pricing page vs footer shelf)
    const caps = [...document.querySelectorAll('div,span')].filter((e) => e.childElementCount === 0 && CREDIT_TEXTS.includes(e.textContent.trim()));
    for (const c of caps) {
      let card = c;
      while (card && !/Create account/.test(card.innerText || '')) card = card.parentElement;
      if (!card) continue;
      const btn = [...card.querySelectorAll('[role=button],button,a')].find((b) => /Create account/.test(b.innerText)) || card;
      const r = card.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      // clipping inside the card
      const clipped = [];
      card.querySelectorAll('*').forEach((e) => {
        if (!e.textContent.trim() || e.childElementCount > 1) return;
        const s = getComputedStyle(e);
        const clamps = s.overflow === 'hidden' || s.webkitLineClamp !== 'none' || s.textOverflow === 'ellipsis';
        if (clamps && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) clipped.push(e.textContent.trim().slice(0, 60));
        const er = e.getBoundingClientRect();
        if (er.width && (er.right > r.right + 1 || er.left < r.left - 1)) clipped.push('OVERFLOWS CARD: ' + e.textContent.trim().slice(0, 60));
      });
      res.push({ caption: c.textContent.trim(), cardTop: Math.round(r.top), cardBottom: Math.round(r.bottom), cardH: Math.round(r.height), btnBottom: Math.round(b.bottom), btnTop: Math.round(b.top), left: Math.round(r.left), text: card.innerText.replace(/\s+/g, ' ').slice(0, 400), clipped: [...new Set(clipped)] });
    }
    return res;
  }, CREDIT_TEXTS);
}

function groupRows(cards) {
  // cards on the same visual row share cardTop (within 4px)
  const rows = [];
  for (const c of cards) {
    const row = rows.find((r) => Math.abs(r[0].cardTop - c.cardTop) < 6);
    row ? row.push(c) : rows.push([c]);
  }
  return rows;
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const theme of THEMES) {
    for (const w of WIDTHS) {
      const h = w === 390 ? 844 : w === 768 ? 1024 : 1000;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      await ctx.addInitScript((t) => { try { localStorage.setItem('v5:theme', t); } catch {} }, theme);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      for (const route of ['/', '/pricing/', '/solutions/custom-automation/']) {
        const name = route === '/' ? 'home' : route === '/pricing/' ? 'pricing' : 'custom-automation';
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        await page.evaluate(() => { const b = [...document.querySelectorAll('[role=button],button')].find((e) => /^Reject( optional)?$/.test(e.innerText.trim())); if (b) b.click(); });
        await page.waitForTimeout(400);
        const themeLabel = await page.evaluate(() => {
          const el = [...document.querySelectorAll('[aria-label^="Theme:"]')][0];
          return el ? el.getAttribute('aria-label') : null;
        });
        const overflow = await page.evaluate(() => {
          const d = document.documentElement;
          const sc = [...document.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 10).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
          return { doc: d.scrollWidth - window.innerWidth, sc: sc ? sc.scrollWidth - sc.clientWidth : 0 };
        });
        const tag = `${name}-${w}-${theme}`;
        await page.screenshot({ path: `${OUT}/${tag}-top.jpg`, type: 'jpeg', quality: 72 });
        const entry = { tag, theme, w, route, themeLabel, overflow, errors: [...errors] };
        if (name === 'home') {
          await scrollToText(page, 'Start lean. Scale when growth demands it.');
          await page.screenshot({ path: `${OUT}/${tag}-pricing-shelf.jpg`, type: 'jpeg', quality: 72 });
          entry.cards = await inspectCards(page);
          entry.shelfNote = await page.evaluate(() => (document.body.innerText.match(/Personal \$[^\n]*Billing\./) || [null])[0]);
          entry.bodyText = await page.evaluate(() => document.body.innerText);
        } else if (name === 'custom-automation') {
          await scrollToText(page, 'Pay as you go');
          await page.screenshot({ path: `${OUT}/${tag}-plan-strip.jpg`, type: 'jpeg', quality: 72 });
          entry.stripText = await page.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('Pay as you go'); return t.slice(Math.max(0, i - 120), i + 200); });
        } else {
          await scrollToText(page, 'Monthly');
          entry.faq = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).flatMap((d) => d['@graph'] || [d]).filter((d) => d['@type'] === 'FAQPage').map((d) => d.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])));
          await page.screenshot({ path: `${OUT}/${tag}-plans-monthly.jpg`, type: 'jpeg', quality: 72 });
          entry.cards = await inspectCards(page);
          await page.click('[aria-label="Annual billing, save 20 percent"]');
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${OUT}/${tag}-plans-yearly.jpg`, type: 'jpeg', quality: 72 });
          entry.cardsYearly = await inspectCards(page);
          entry.bodyTextYearly = await page.evaluate(() => document.body.innerText);
          // compare table under yearly
          await scrollToText(page, 'Included credits each month');
          await page.screenshot({ path: `${OUT}/${tag}-compare-yearly.jpg`, type: 'jpeg', quality: 72 });
          // CTA destination: click the first plan card button, capture navigation request
          const reqP = page.waitForRequest((r) => r.isNavigationRequest() && !r.url().includes('/pricing'), { timeout: 5000 }).catch(() => null);
          await scrollToText(page, 'Monthly');
          await page.evaluate(() => {
            const cap = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && e.textContent.trim() === '500 credits each month');
            let card = cap; while (card && !/Create account/.test(card.innerText)) card = card.parentElement;
            const btn = [...card.querySelectorAll('[role=button],button,a')].find((b) => /Create account/.test(b.innerText));
            btn.click();
          });
          const req = await reqP;
          entry.ctaUrl = req ? req.url() : null;
        }
        report.push(entry);
        errors.length = 0;
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/../report.json`, JSON.stringify(report, null, 1));
  console.log('done', report.length);
})();
