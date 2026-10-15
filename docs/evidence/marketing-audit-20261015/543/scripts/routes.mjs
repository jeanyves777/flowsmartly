// Route audit (claude-local). Usage: node routes.mjs <distDir> <outDir> <srcAppDir> <port> [--shots-only]
// Serves the LOCAL export only; every non-localhost request is aborted (nothing leaves the machine).
import fs from 'node:fs'; import path from 'node:path';
import { serve, launch, utc, sleep, overflowInfo, fullShot } from './lib.mjs';
const [dist, out, srcApp, portS, flag] = process.argv.slice(2); const port = Number(portS); const shotsOnly = flag === '--shots-only';
fs.mkdirSync(out, { recursive: true });
// --- enumerate routes from source (expo-router file routes)
const routes = [];
(function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { walk(p, rel + '/' + e.name); continue; } if (!/\.tsx$/.test(e.name) || e.name.startsWith('_') || e.name.startsWith('+')) continue; let r = rel + '/' + e.name.replace(/\.tsx$/, ''); r = r.replace(/\/index$/, '') || '/'; routes.push(r); } })(srcApp, '');
const postsDir = path.join(srcApp, '../content/posts'); const slugs = fs.existsSync(postsDir) ? fs.readdirSync(postsDir).filter(f => /\.md$/.test(f)).map(f => f.replace(/\.md$/, '')) : [];
const expanded = []; for (const r of routes.sort()) { if (r.includes('[slug]')) { for (const s of slugs) expanded.push(r.replace('[slug]', s)); } else expanded.push(r); }
const all = [...new Set(expanded)]; if (!all.includes('/')) all.unshift('/');
fs.writeFileSync(path.join(out, 'routes-enumerated.txt'), `source modules -> ${routes.length}; blog slugs ${JSON.stringify(slugs)}\n` + all.join('\n') + '\n');
const approvedSet = new Set(all);
const srv = await serve(path.resolve(dist), port); const browser = await launch(); const B = `http://127.0.0.1:${port}`;
const WIDTHS = [390, 768, 1440]; const result = { utc: utc(), routes: all, rows: [], interactions: [], cta: [], links: [] };
const slug = r => (r === '/' ? 'home' : r.slice(1).replace(/\//g, '_'));
async function newPage(w) {
  const pg = await browser.newPage(); await pg.setViewport({ width: w, height: 900 }); await pg.setRequestInterception(true);
  pg.ext = []; pg.navReq = []; pg.issues = [];
  pg.on('request', req => { const u = req.url(); if (/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(u)) { if (req.isNavigationRequest() && req.frame() === pg.mainFrame()) pg.navReq.push(u); req.continue(); } else { pg.ext.push(req.method() + ' ' + u.slice(0, 120)); if (req.isNavigationRequest() && req.frame() === pg.mainFrame()) pg.navReq.push(u); req.abort(); } });
  pg.on('pageerror', e => pg.issues.push('pageerror: ' + e.message.slice(0, 200)));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/net::ERR_FAILED/.test(t)) pg.issues.push(m.type() + ': ' + t.slice(0, 200)); } });
  pg.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1')) pg.issues.push('http' + r.status() + ': ' + r.url().replace(B, '')); });
  return pg;
}
const scrollAll = async pg => { await pg.evaluate(async () => { const sc = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 50 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement; for (let y = 0; y < sc.scrollHeight; y += 500) { sc.scrollTop = y; await new Promise(r => setTimeout(r, 60)); } sc.scrollTop = 0; }); };
for (const w of WIDTHS) {
  for (const r of all) {
    const pg = await newPage(w); const t0 = utc(); let status = null, err = null;
    try { const resp = await pg.goto(B + r, { waitUntil: 'networkidle0', timeout: 45000 }); status = resp.status(); await scrollAll(pg); await sleep(200); } catch (e) { err = e.message.slice(0, 150); }
    const info = await pg.evaluate(() => ({ title: document.title, h1: [...document.querySelectorAll('[role="heading"][aria-level="1"],h1')].map(e => e.innerText.slice(0, 50)), text: document.body.innerText.length, imgs: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => (i.currentSrc || i.src).slice(-70)), notFound: /page (can.t|could not) be found|404/i.test(document.body.innerText.slice(0, 400)), finalPath: location.pathname })).catch(() => ({}));
    const ov = await overflowInfo(pg).catch(() => ({}));
    const row = { route: r, w, status, utc: t0, err, ...info, hOverflow: ov.hOverflow, offscreen: ov.offscreen, scW: ov.scW, vw: ov.vw, issues: [...new Set(pg.issues)].slice(0, 6), extBlocked: [...new Set(pg.ext)].slice(0, 5) };
    row.pass = !err && status === 200 && !row.notFound && !row.hOverflow && (!ov.offscreen || ov.offscreen.length === 0) && (info.imgs || []).length === 0 && row.issues.length === 0 && (info.text || 0) > 200;
    result.rows.push(row); console.log(w, r, status, row.pass ? 'PASS' : 'FAIL ' + JSON.stringify({ ov: row.hOverflow, off: (row.offscreen || []).slice(0, 2), imgs: info.imgs, issues: row.issues, err }));
    await fullShot(pg, path.join(out, `${slug(r)}-${w}.jpg`), 40).catch(e => console.log('shot fail', e.message));
    if (!shotsOnly) {
      // links
      if (w === 1440) {
        const links = await pg.$$eval('a[href]', as => as.map(a => ({ href: a.getAttribute('href'), text: (a.innerText || a.getAttribute('aria-label') || '').slice(0, 40).replace(/\n/g, ' ') })));
        for (const l of links) { let cls; const h = l.href; if (/^(mailto:|tel:)/.test(h)) cls = 'mailto/tel'; else if (h.startsWith('#')) cls = 'anchor'; else if (/^https?:\/\//.test(h)) { cls = /^https?:\/\/(www\.)?flowsmartly\.com/.test(h) ? 'own-origin-absolute' : 'external'; } else { const p = h.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'; cls = approvedSet.has(p) ? 'internal-ok' : 'internal-NOT-IN-ROUTE-SET'; } result.links.push({ from: r, ...l, cls }); }
        // interactive sweep (no submission: externals are aborted; navigations are recorded and reverted)
        const n = await pg.$$eval('[role="button"],button,[role="tab"],[role="switch"],[aria-expanded],[aria-pressed]', els => els.length);
        const sweep = []; const cap = Math.min(n, 25);
        for (let i = 0; i < cap; i++) {
          const res = await pg.evaluate(i => { const els = [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="switch"],[aria-expanded],[aria-pressed]')]; const e = els[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { label: (e.getAttribute('aria-label') || e.innerText || e.tagName).slice(0, 40).replace(/\n/g, ' '), vis: r.width > 0 && r.height > 0, disabled: e.getAttribute('aria-disabled') === 'true' || e.disabled, x: r.x + r.width / 2, y: r.y + r.height / 2, before: JSON.stringify([e.getAttribute('aria-expanded'), e.getAttribute('aria-pressed'), e.getAttribute('aria-selected'), e.getAttribute('aria-checked')]), html: document.body.innerHTML.length }; }, i);
          if (!res || !res.vis || res.disabled) continue;
          const urlBefore = pg.url(); pg.navReq.length = 0;
          try { await pg.evaluate(i => { const els = [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="switch"],[aria-expanded],[aria-pressed]')]; els[i].scrollIntoView({ block: 'center' }); }, i); const pos = await pg.evaluate(i => { const e = [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="switch"],[aria-expanded],[aria-pressed]')][i]; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i); await pg.mouse.click(pos.x, pos.y); await sleep(350); } catch (e) { sweep.push({ label: res.label, err: e.message.slice(0, 80) }); continue; }
          const after = await pg.evaluate(i => { const e = [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="switch"],[aria-expanded],[aria-pressed]')][i]; return e ? { st: JSON.stringify([e.getAttribute('aria-expanded'), e.getAttribute('aria-pressed'), e.getAttribute('aria-selected'), e.getAttribute('aria-checked')]), html: document.body.innerHTML.length, dialog: !!document.querySelector('[role="dialog"]'), theme: localStorage.getItem('v5:theme') } : { gone: true }; }, i).catch(() => ({ navigated: true }));
          const navd = pg.url() !== urlBefore || pg.navReq.length > 0; const changed = navd || after.gone || after.navigated || after.st !== res.before || after.html !== res.html || after.dialog;
          sweep.push({ label: res.label, changed, nav: navd ? (pg.navReq[0] || pg.url()).replace(B, '') : undefined, dialog: after.dialog });
          if (after.dialog) { await pg.keyboard.press('Escape'); await sleep(300); }
          if (navd) { try { await pg.goto(B + r, { waitUntil: 'networkidle0' }); } catch {} }
        }
        result.interactions.push({ route: r, controls: n, tested: sweep.length, inert: sweep.filter(s => s.changed === false).map(s => s.label), navs: sweep.filter(s => s.nav).map(s => s.label + ' -> ' + s.nav), errs: sweep.filter(s => s.err).length });
      }
      // Create account CTAs: record destinations at every width
      const cands = await pg.$$eval('a,[role="button"],button', els => els.filter(e => /create (an |your |a )?(free )?account/i.test((e.innerText || e.getAttribute('aria-label') || '')) && e.getBoundingClientRect().width > 0).map((e, i) => { e.setAttribute('data-cta', String(i)); return { i, text: (e.innerText || e.getAttribute('aria-label')).slice(0, 40).replace(/\n/g, ' '), href: e.getAttribute('href'), tag: e.tagName }; }));
      for (const c of cands) {
        pg.navReq.length = 0; const before = pg.url(); let dest = c.href;
        try { await pg.evaluate(i => document.querySelector(`[data-cta="${i}"]`).scrollIntoView({ block: 'center' }), c.i); const p = await pg.evaluate(i => { const r = document.querySelector(`[data-cta="${i}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, c.i); await pg.mouse.click(p.x, p.y); await sleep(900); } catch (e) { dest = 'CLICK-ERR ' + e.message.slice(0, 60); }
        const finalUrl = pg.navReq.length ? pg.navReq[pg.navReq.length - 1] : pg.url();
        result.cta.push({ route: r, w, text: c.text, tag: c.tag, href: c.href, navRequests: [...pg.navReq].map(u => u.replace(B, '[local]')), finalUrl: finalUrl.replace(B, '[local]'), utc: utc() });
        if (pg.url() !== before || pg.navReq.length) { try { await pg.goto(B + r, { waitUntil: 'networkidle0' }); await pg.$$eval('a,[role="button"],button', els => els.filter(e => /create (an |your |a )?(free )?account/i.test((e.innerText || e.getAttribute('aria-label') || '')) && e.getBoundingClientRect().width > 0).forEach((e, i) => e.setAttribute('data-cta', String(i)))); } catch {} }
      }
    }
    await pg.close();
  }
}
fs.writeFileSync(path.join(out, 'route-audit.json'), JSON.stringify(result, null, 1));
console.log('DONE rows', result.rows.length, 'fail', result.rows.filter(r => !r.pass).length); await browser.close(); srv.close();
