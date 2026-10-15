// PR #544 interaction-feedback checks (puppeteer, local export of the exact SHA).
import fs from 'node:fs'; import path from 'node:path';
import { serve, launch, utc, sleep } from './lib.mjs';
const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const srv = await serve(path.resolve(dist), 8101); let browser = await launch(); const browserTouch = await launch(true); const B = 'http://127.0.0.1:8101';
const R = { checks: [], notes: [] };
const ok = (n, p, d = '') => { R.checks.push({ n, p, d }); console.log(p ? 'PASS' : 'FAIL', n, d); };
async function pageFor({ w = 1440, h = 900, rm = false, touch = false, theme = 'light' } = {}) {
  const pg = await (touch ? browserTouch : browser).newPage(); await pg.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch });
  await pg.evaluateOnNewDocument(m => { try { localStorage.setItem('v5:theme', m); } catch {} }, theme);
  // browser launched with --blink-settings hover/pointer = mouse (headless default is hover:none) so the PR's (hover:hover) and (pointer:fine) gate matches; touch runs use hasTouch.
  const feats = []; if (rm) feats.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (feats.length) { const cdp = await pg.createCDPSession(); await cdp.send('Emulation.setEmulatedMedia', { features: feats }); }
  await pg.setRequestInterception(true); pg.ext = []; pg.on('request', req => { const u = req.url(); if (/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(u)) req.continue(); else { pg.ext.push(u.slice(0, 100)); req.abort(); } });
  pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') pg.errs.push(m.text()); });
  return pg;
}
const styleOf = (pg, sel) => pg.$eval(sel, e => {
  const s = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { transform: s.transform, transition: s.transitionDuration + ' ' + s.transitionProperty, outline: s.outlineStyle + ' ' + s.outlineWidth, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
});
const ringOk = f => (f.fv && f.os !== 'none' && parseFloat(f.ow) >= 2) || (f.bs && f.bs !== 'none');
const routes = ['/', '/pricing', '/solutions/video-studio', '/company/about', '/company/contact', '/platform/ai-studio', '/solutions/domains', '/platform/email-sms'];

// 1. keyboard focus ring on representative routes (1440)
for (const r of routes) {
  const pg = await pageFor({}); await pg.goto(B + r, { waitUntil: 'networkidle0' }); const seen = []; const bad = [];
  for (let i = 0; i < 45; i++) {
    await pg.keyboard.press('Tab');
    const f = await pg.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { t: e.tagName, role: e.getAttribute('role'), label: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('href') || '').slice(0, 30).replace(/\n/g, ' '), fv: e.matches(':focus-visible'), ow: s.outlineWidth, os: s.outlineStyle, oc: s.outlineColor, bs: s.boxShadow, w: r.width, h: r.height };
    });
    if (!f) continue; seen.push(f); if (!ringOk(f) && f.w > 0) bad.push(f);
  }
  ok(`focus ring on every tabbed control ${r}`, bad.length === 0 && seen.length > 0, `tabbed=${seen.length} ring-less=${bad.length} ` + JSON.stringify(bad.slice(0, 3)));
  R['firstTabStops ' + r] = seen.slice(0, 6).map(s => s.label + ' | ' + s.os + ' ' + s.ow + ' ' + s.oc);
  if (r === '/') await pg.screenshot({ path: path.join(out, 'focus-ring-home-1440.png') });
  await pg.close();
}

// 2-4. hover/press/disabled/reduced-motion: synthetic fixture (no disabled controls guaranteed in routes) + a real CTA
async function probe(pg, sel, label) {
  const base = await styleOf(pg, sel); await pg.hover(sel); await sleep(350); const hov = await styleOf(pg, sel);
  const box = await pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await pg.mouse.move(box.x, box.y); await pg.mouse.down(); await sleep(300); const prs = await styleOf(pg, sel); await pg.mouse.move(2, 2); await pg.mouse.up(); await sleep(300);
  return { label, base: base.transform, hover: hov.transform, press: prs.transform, hoverTrans: hov.transition, dyHover: hov.rect.y - base.rect.y, dhHover: hov.rect.h - base.rect.h };
}
for (const rm of [false, true]) {
  const pg = await pageFor({ rm }); await pg.goto(B + '/', { waitUntil: 'networkidle0' });
  await pg.evaluate(() => {
    const root = document.getElementById('root'); const box = document.createElement('div'); box.id = 'fx';
    box.style.cssText = 'position:fixed;left:20px;top:100px;z-index:99999;display:flex;gap:16px;flex-direction:column;background:#fff;padding:12px';
    box.innerHTML = '<button id="b-en" style="padding:12px">enabled button</button><button id="b-dis" disabled style="padding:12px">disabled button</button><a id="a-en" href="#x" style="padding:12px;display:inline-block">enabled link</a><a id="a-dis" aria-disabled="true" href="#x" style="padding:12px;display:inline-block">aria-disabled link</a><div id="r-en" role="button" tabindex="0" style="padding:12px">role button</div><div id="r-dis" role="button" aria-disabled="true" tabindex="-1" style="padding:12px">aria-disabled role button</div>';
    root.appendChild(box);
  });
  const rows = []; for (const id of ['b-en', 'b-dis', 'a-en', 'a-dis', 'r-en', 'r-dis']) rows.push(await probe(pg, '#' + id, id));
  R['fixture_rm_' + rm] = rows;
  for (const x of rows) {
    const en = x.label.endsWith('-en');
    if (!rm) ok(`[fixture] ${x.label} ${en ? 'lifts on hover and presses' : 'does NOT move'}`, en ? (x.hover !== 'none' && x.press !== 'none') : (x.hover === 'none' && x.press === 'none'), `hover=${x.hover} press=${x.press} dy=${x.dyHover}`);
    else ok(`[fixture, reduced-motion] ${x.label} no transform/transition`, x.hover === 'none' && x.press === 'none' && /^0s/.test(x.hoverTrans), `hover=${x.hover} press=${x.press} trans=${x.hoverTrans}`);
  }
  const real = await pg.$$eval('button,[role="button"],[role="link"],a[href]', els => els.filter(e => e.closest('#root') && !e.closest('#fx') && /Create (an )?account/i.test((e.textContent||'')+(e.getAttribute('aria-label')||''))).map((e, i) => { e.setAttribute('data-probe', 'cta' + i); return 'cta' + i; }));
  if (real.length) {
    const x = await probe(pg, `[data-probe="${real[0]}"]`, 'real CTA Create an account'); R['realCTA_rm_' + rm] = x;
    ok(`[real route rm=${rm}] hero CTA ${rm ? 'no transform' : 'lifts + presses'}`, rm ? (x.hover === 'none' && x.press === 'none') : (x.hover !== 'none' && x.press !== 'none'), JSON.stringify(x));
  } else ok('real CTA found', false, 'none');
  if (!rm) {
    const m = () => pg.evaluate(() => { const e = document.querySelector('[data-probe="cta0"]'); const sibs = [...e.parentElement.parentElement.children].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }); const sc = [...document.querySelectorAll('*')].filter(x => x.scrollHeight > x.clientHeight + 50)[0]; return { sibs, scH: sc && sc.scrollHeight }; });
    const a = await m(); await pg.hover('[data-probe="cta0"]'); await sleep(300); const b = await m();
    ok('no layout shift on hover (parent siblings rects + scroll height)', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }).slice(0, 300));
  } else {
    await pg.reload({ waitUntil: 'networkidle0' }); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
    const f = await pg.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { label: (e.getAttribute('aria-label') || e.innerText || '').slice(0, 30), fv: e.matches(':focus-visible'), ow: s.outlineWidth, os: s.outlineStyle, oc: s.outlineColor }; });
    ok('[reduced-motion] focus ring still visible', f.fv && f.os !== 'none' && parseFloat(f.ow) >= 2, JSON.stringify(f));
    await pg.screenshot({ path: path.join(out, 'focus-ring-reduced-motion.png') });
  }
  await pg.close();
}

// 5. compact nav dialog at 390 (keyboard and touch)
for (const mode of ['keyboard', 'touch']) {
  const pg = await pageFor({ w: 390, h: 844, touch: mode === 'touch' }); await pg.goto(B + '/', { waitUntil: 'networkidle0' });
  await pg.evaluate(() => { document.querySelector('[aria-label="Open navigation"]').setAttribute('data-trig', '1'); });
  const open = async () => {
    if (mode === 'touch') { const e = await pg.$('[data-trig]'); await e.tap(); } else { await pg.focus('[data-trig]'); await pg.keyboard.press('Enter'); }
    await sleep(700);
  };
  const state = () => pg.evaluate(() => { const dl = document.querySelector('[role="dialog"]'); const ae = document.activeElement; return { dialog: !!dl, label: dl && dl.getAttribute('aria-label'), modal: dl && dl.getAttribute('aria-modal'), focusInside: !!(dl && dl.contains(ae)), active: ae && (ae.getAttribute('aria-label') || ae.innerText || ae.tagName || '').slice(0, 30), activeIsTrigger: !!(ae && ae.hasAttribute('data-trig')), trigExpanded: (document.querySelector('[data-trig]') || {}).getAttribute && document.querySelector('[data-trig]').getAttribute('aria-expanded') }; });
  await open(); const d = await state();
  ok(`[nav ${mode}] opens as named modal dialog`, d.dialog && d.label === 'Navigation menu' && d.modal === 'true', JSON.stringify(d));
  ok(`[nav ${mode}] focus moves inside dialog on open`, d.focusInside, JSON.stringify(d));
  await pg.screenshot({ path: path.join(out, `nav-open-${mode}-390.png`) });
  if (mode === 'keyboard') {
    const ring = []; let escaped = 0;
    for (let i = 0; i < 30; i++) {
      await pg.keyboard.press('Tab');
      const f = await pg.evaluate(() => { const dl = document.querySelector('[role="dialog"]'); const e = document.activeElement; const s = getComputedStyle(e); return { in: !!(dl && dl.contains(e)), t: (e.getAttribute('aria-label') || e.innerText || e.tagName).slice(0, 25).replace(/\n/g, ' '), os: s.outlineStyle, ow: s.outlineWidth, oc: s.outlineColor, fv: e.matches(':focus-visible') }; });
      if (!f.in) escaped++; ring.push(f);
    }
    R.navTab = ring.slice(0, 14);
    ok('[nav keyboard] 30 Tabs never leave dialog (focus trap)', escaped === 0, `escaped=${escaped}`);
    const nr = ring.filter(f => f.in && !(f.fv && f.os !== 'none' && parseFloat(f.ow) >= 2));
    ok('[nav keyboard] every focused dialog control shows ring', nr.length === 0, JSON.stringify(nr.slice(0, 3)));
    await pg.screenshot({ path: path.join(out, 'nav-open-focus-ring-390.png') });
  }
  await pg.keyboard.press('Escape'); await sleep(700);
  const c = await state();
  ok(`[nav ${mode}] Escape closes dialog`, !c.dialog, JSON.stringify(c));
  ok(`[nav ${mode}] focus restored to Open navigation trigger`, c.activeIsTrigger, JSON.stringify(c));
  await open(); const cb = await pg.$('[aria-label="Close navigation"]');
  if (cb) {
    if (mode === 'touch') await cb.tap(); else { await pg.focus('[aria-label="Close navigation"]'); await pg.keyboard.press('Enter'); }
    await sleep(700); const c2 = await state();
    ok(`[nav ${mode}] Close button closes + restores focus`, !c2.dialog && c2.activeIsTrigger, JSON.stringify(c2));
  } else ok(`[nav ${mode}] Close navigation control reachable while open`, false, 'not found in DOM');
  if (mode === 'touch') { const m = await pg.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches); ok('[touch] fine-pointer hover media not matched (no sticky lift)', m === false, 'matches=' + m); }
  R['pageErrors_nav_' + mode] = pg.errs; R['externalBlocked_nav_' + mode] = [...new Set(pg.ext)]; await pg.close();
}
fs.writeFileSync(path.join(out, 'feedback-results.json'), JSON.stringify({ utc: utc(), ...R }, null, 1));
console.log('FAILS:', R.checks.filter(c => !c.p).length); await browser.close(); await browserTouch.close(); srv.close();
