// Puppeteer port of the PR #545 checks (the PR's script calls Playwright-only APIs) + theme/width matrix.
import fs from 'node:fs'; import path from 'node:path';
import { serve, launch, utc, sleep, overflowInfo, fullShot } from './lib.mjs';
const [dist,out]=process.argv.slice(2); fs.mkdirSync(out,{recursive:true});
const srv=await serve(path.resolve(dist),8097); const browser=await launch();
const R={checks:[],matrix:[],console:[]}; const ok=(n,p,d='')=>{R.checks.push({n,p,d});console.log(p?'PASS':'FAIL',n,d);};
const URL_='http://127.0.0.1:8097/solutions/video-studio';
async function newPage(theme,rm){const pg=await browser.newPage(); if(theme) await pg.evaluateOnNewDocument(m=>{try{localStorage.setItem('v5:theme',m)}catch{}},theme);
  if(rm) await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:rm}]);
  pg.on('pageerror',e=>R.console.push({t:'pageerror',m:e.message,theme,rm})); pg.on('console',m=>{if(['error','warning'].includes(m.type()))R.console.push({t:m.type(),m:m.text(),loc:m.location()?.url,theme,rm})});
  pg.on('requestfailed',r=>R.console.push({t:'requestfailed',m:r.url()})); pg.on('response',r=>{if(r.status()>=400)R.console.push({t:'http'+r.status(),m:r.url()})});
  return pg;}
// ---- PR script parity, reduced motion
let pg=await newPage('light','reduce'); await pg.goto(URL_,{waitUntil:'networkidle0'});
const h1=await pg.$$eval('[role="heading"][aria-level="1"]',e=>e.map(x=>x.innerText)); ok('one primary heading',h1.length===1,JSON.stringify(h1)); ok('h1 matches /Make your next story/',/Make your next story/.test(h1[0]||''));
ok('reduced motion matches',await pg.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
ok('h1 opacity 1 under reduced motion',(await pg.$eval('[role="heading"][aria-level="1"]',e=>getComputedStyle(e).opacity))==='1');
const btn=l=>`[role="button"][aria-label="Show ${l} reference"]`;
await pg.click(btn('Social')); ok('Social aria-pressed true after click',(await pg.$eval(btn('Social'),e=>e.getAttribute('aria-pressed')))==='true');
ok('first img alt mentions creator-style social video',/creator-style social video/i.test(JSON.stringify(await pg.$$eval('img',x=>x.map(i=>i.alt)))),JSON.stringify(await pg.$$eval('img',x=>x.map(i=>i.alt))));
ok('disclaimer text present',/This selector changes the preview only/.test(await pg.evaluate(()=>document.body.innerText)));
await pg.reload({waitUntil:'networkidle0'}); let reached=false,steps=0;
for(;steps<60;steps++){await pg.keyboard.press('Tab'); reached=await pg.$eval(btn('Campaign'),e=>document.activeElement===e); if(reached)break;}
ok('natural Tab reaches Campaign control',reached,'steps='+(steps+1));
const bw=await pg.$eval(btn('Campaign'),e=>{const s=getComputedStyle(e);return {borderWidth:s.borderWidth,outline:s.outline,boxShadow:s.boxShadow,outlineOffset:s.outlineOffset}}); R.focusStyle=bw; ok('focus visible style (borderWidth 2px per PR script)',bw.borderWidth==='2px',JSON.stringify(bw));
await pg.screenshot({path:path.join(out,'focus-campaign-reduced.png')});
await pg.keyboard.press('Space'); ok('Space selects Campaign (aria-pressed)',(await pg.$eval(btn('Campaign'),e=>e.getAttribute('aria-pressed')))==='true');
ok('img alt matches /campaign still/',/campaign still/i.test(JSON.stringify(await pg.$$eval('img',x=>x.map(i=>i.alt)))),JSON.stringify(await pg.$$eval('img',x=>x.map(i=>i.alt))));
// FAQ: record real behaviour; PR script asserts 'false' after first click then 'true' (looks inverted)
const faqSel='[role="button"]'; const faq=await pg.evaluateHandle(()=>[...document.querySelectorAll('[role="button"]')].find(e=>/Can I generate a video from this page/.test(e.innerText||e.getAttribute('aria-label')||'')));
const exp=async()=>faq.evaluate(e=>e.getAttribute('aria-expanded')); const before=await exp(); await faq.click(); const a1=await exp(); await faq.click(); const a2=await exp();
R.faq={before,afterClick1:a1,afterClick2:a2}; ok('FAQ toggles aria-expanded (real behaviour recorded)',before!==a1&&a1!==a2,JSON.stringify(R.faq));
ok('FAQ answer text visible when expanded',/Video generation is not wired to this page/.test(await pg.evaluate(()=>document.body.innerText)));
for(const w of [390,768,1024,1536]){await pg.setViewport({width:w,height:960}); await sleep(300); const d=await pg.evaluate(()=>({vp:innerWidth,doc:document.documentElement.scrollWidth,main:document.querySelector('[role="main"]')?.scrollWidth,mc:document.querySelector('[role="main"]')?.clientWidth})); ok('no overflow @'+w,d.doc<=d.vp&&d.main<=d.mc+1,JSON.stringify(d)); if(w===390||w===1536) await fullShot(pg,path.join(out,`video-studio-${w}.png`)); const oi=await overflowInfo(pg); ok('scroller/offscreen overflow @'+w,!oi.hOverflow&&oi.offscreen.length===0,JSON.stringify(oi));}
await pg.close();
// ---- Natural Space on page scroll (Space on non-control scrolls page) and Tab order over all focusables
pg=await newPage('light',null); await pg.goto(URL_,{waitUntil:'networkidle0'}); await pg.evaluate(()=>window.scrollTo(0,0)); await pg.keyboard.press('Space'); await sleep(400); R.spaceBeforeClick=await pg.evaluate(()=>Math.max(0,...[...document.querySelectorAll('*')].map(e=>e.scrollTop||0))); await pg.mouse.click(5,450); await pg.keyboard.press('Space'); await sleep(500); R.spaceAfterBlankClick=await pg.evaluate(()=>Math.max(0,...[...document.querySelectorAll('*')].map(e=>e.scrollTop||0))); const sy=await pg.evaluate(()=>Math.max(scrollY,...[...document.querySelectorAll('*')].map(e=>e.scrollTop||0))); ok('Space scrolls with no prior click (informational)',sy>0,'before='+R.spaceBeforeClick+' afterBlankClick='+R.spaceAfterBlankClick);
const order=[]; await pg.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)}); for(let i=0;i<40;i++){await pg.keyboard.press('Tab'); order.push(await pg.evaluate(()=>{const e=document.activeElement;return e?(e.getAttribute('aria-label')||e.innerText||e.tagName).slice(0,40).replace(/\n/g,' '):null}));} R.tabOrder=order; await pg.close();
// ---- Theme x width matrix (no reduced motion), plus reduced-motion check per theme
for(const theme of ['light','grey','dark']){ const p=await newPage(theme,null); await p.goto(URL_,{waitUntil:'networkidle0'});
  for(const w of [390,768,1024,1280,1536,1920]){await p.setViewport({width:w,height:960}); await sleep(250);
    const d=await p.evaluate(()=>{const bg=getComputedStyle(document.body).backgroundColor;const imgs=[...document.images];return {vp:innerWidth,doc:document.documentElement.scrollWidth,bg,broken:imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src.slice(-60)),imgs:imgs.length,stored:localStorage.getItem('v5:theme')}});
    const oi=await overflowInfo(p); const row={theme,w,...d,overflow:oi.hOverflow,offscreen:oi.offscreen,scH:oi.scH}; R.matrix.push(row); console.log(JSON.stringify(row));
    await fullShot(p,path.join(out,`vs-${theme}-${w}.jpg`),55); }
  await p.close(); }
fs.writeFileSync(path.join(out,'video-studio-results.json'),JSON.stringify({utc:utc(),...R},null,1));
console.log('FAILS:',R.checks.filter(c=>!c.p).length,'console entries:',R.console.length); await browser.close(); srv.close();
