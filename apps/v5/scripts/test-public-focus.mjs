import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(app, 'dist');
const output = path.resolve(process.env.V5_FOCUS_QA_OUTPUT_DIR || path.join(tmpdir(), 'v5-focus-qa'));
await mkdir(output, { recursive: true });
const results = [];
const errors = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const requested = path.resolve(dist, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (requested !== dist && !requested.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
    const files = requested === dist ? [path.join(dist, 'index.html')] : [requested, `${requested}.html`, path.join(requested, 'index.html')];
    for (const file of files) {
      if (!(await stat(file).catch(() => null))?.isFile()) continue;
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
      return;
    }
    response.writeHead(404).end();
  } catch { response.writeHead(500).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'] });
let touchBrowser;
let failure;

async function openPage(owner, route = '/', width = 1440, theme = 'light', reduced = true, touch = false) {
  const page = await owner.newPage();
  await page.setViewport({ width, height: 960, hasTouch: touch, isMobile: touch });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument((mode) => localStorage.setItem('v5:theme', mode), theme);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) request.continue();
    else request.abort();
  });
  page.on('pageerror', (error) => errors.push({ route, width, theme, error: error.message }));
  page.on('console', (message) => { if (message.type() === 'error') errors.push({ route, width, theme, error: message.text() }); });
  assert.equal((await page.goto(origin + route, { waitUntil: 'networkidle0', timeout: 60_000 })).status(), 200);
  await page.waitForSelector(`[aria-label="Theme: ${theme}. Change theme"]`);
  const reject = await page.$('button[aria-label="Reject optional cookies"], [role="button"][aria-label="Reject optional cookies"]');
  if (reject) await reject.click();
  return page;
}

async function activeObservation(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return { tag: element.tagName, id:element.id, role: element.getAttribute('role'), name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80), fixture: element.dataset.focusFixture, visible: element.getClientRects().length > 0, keyboard: element.matches(':focus-visible'), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, outlineColor: style.outlineColor, transform: style.transform, disabled: element.hasAttribute('disabled') };
  });
}
function assertRing(observation, context) {
  assert.equal(observation.outlineWidth, '3px', `${context}: ${JSON.stringify(observation)}`);
  assert.equal(observation.outlineStyle, 'solid', context);
  assert.equal(observation.outlineColor, 'rgb(109, 94, 252)', context);
}

async function fixtures(page) {
  await page.evaluate(() => {
    const fixture = document.createElement('div');
    fixture.id = 'focus-fixtures';
    fixture.style.cssText = 'position:fixed;z-index:2147483647;left:16px;top:100px;max-width:calc(100% - 32px);display:flex;flex-wrap:wrap;gap:12px;padding:16px;background:white;color:black';
    for (const [kind, tag, role] of [['role-link','div','link'],['role-tab','div','tab'],['role-checkbox','div','checkbox'],['input','input',null],['textarea','textarea',null],['button','button',null],['anchor','a',null]]) {
      const element = document.createElement(tag);
      if (role) element.setAttribute('role', role);
      element.tabIndex = 0;
      element.dataset.focusFixture = kind;
      element.setAttribute('aria-label', kind);
      element.style.cssText = 'max-width:180px;min-height:44px;min-width:44px';
      if (tag === 'a') element.href = '#';
      if (!['input','textarea'].includes(tag)) element.textContent = kind;
      fixture.appendChild(element);
    }
    const disabled = document.createElement('button'); disabled.disabled = true; disabled.textContent = 'Disabled'; disabled.id = 'native-disabled'; fixture.appendChild(disabled);
    const aria = document.createElement('div'); aria.setAttribute('role','button'); aria.setAttribute('aria-disabled','true'); aria.tabIndex=0; aria.textContent='ARIA disabled'; aria.id='aria-disabled'; fixture.appendChild(aria);
    document.getElementById('root').prepend(fixture);
  });
  const seen = new Set();
  for (let step = 0; step < 20 && seen.size < 7; step++) {
    await page.keyboard.press('Tab');
    const observation = await activeObservation(page);
    if (observation.fixture) {
      assertRing(observation, 'Natural Tab through rendered control fixture');
      seen.add(observation.fixture);
      results.push({ kind: 'fixture', ...observation });
    }
    assert(!observation.disabled, 'Disabled native controls must not enter Tab order');
  }
  assert.equal(seen.size, 7, 'Natural Tab must cover every rendered RN-web/native fixture type');
  await page.keyboard.press('Tab');
  assert.equal((await activeObservation(page)).id, 'aria-disabled', 'Natural Tab must skip the native disabled button');
}

async function feedback(page) {
  const button = '[data-focus-fixture="button"]';
  assert(await page.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches), 'The hover proof requires a fine pointer');
  const siblingRects = () => page.$$eval('[data-focus-fixture]:not([data-focus-fixture="button"])', elements=>elements.map(element=>{const box=element.getBoundingClientRect();return [box.x,box.y,box.width,box.height];}));
  const before = await siblingRects();
  await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
  await page.hover(button);
  await page.waitForFunction((selector) => new DOMMatrix(getComputedStyle(document.querySelector(selector)).transform).m42 === -2, {}, button);
  assert.deepEqual(await siblingRects(),before,'Hover transforms must not shift sibling layout');
  await page.mouse.down();
  await page.waitForFunction((selector) => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector(selector)).transform).m42 - 1) < 0.01, {}, button);
  await page.mouse.up();
  for (const selector of ['#native-disabled','#aria-disabled']) {
    await page.hover(selector);
    assert.equal(await page.$eval(selector, (element) => getComputedStyle(element).transform), 'none');
    await page.mouse.down();
    assert.equal(await page.$eval(selector, (element) => getComputedStyle(element).transform), 'none');
    await page.mouse.up();
  }
  await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
  await page.hover(button);
  await page.waitForFunction((selector) => getComputedStyle(document.querySelector(selector)).transform === 'none' && getComputedStyle(document.querySelector(selector)).transitionDuration === '0s', {}, button);
  results.push({ kind:'feedback', hover:true, press:true, disabled:true, reducedMotion:true });
}

try {
  const fixturePage = await openPage(browser);
  await fixtures(fixturePage);
  await feedback(fixturePage);
  await fixturePage.screenshot({ path:path.join(output,'control-fixtures.png') });
  await fixturePage.close();
  if (!process.env.V5_FOCUS_QA_FIXTURE_ONLY) {
    const routes = ['/', '/pricing','/solutions/video-studio','/company/about','/company/contact','/platform/ai-studio','/solutions/domains','/platform/email-sms'];
    for (const theme of ['light','grey','dark']) for (const width of [390,768,1440]) for (const route of routes) {
      const page = await openPage(browser,route,width,theme);
      const stops = [];
      const controlRoute = route === '/company/contact' || route === '/platform/ai-studio';
      let captured = false;
      for (let step=0;step<(controlRoute ? 28 : 12);step++) {
        await page.keyboard.press('Tab');
        const observation = await activeObservation(page);
        if (observation.tag !== 'BODY' && observation.visible && observation.keyboard) assertRing(observation, `${route}/${theme}/${width}`);
        stops.push(observation);
        if (controlRoute && !captured && (['INPUT','TEXTAREA'].includes(observation.tag) || ['tab','checkbox'].includes(observation.role))) {
          await page.screenshot({path:path.join(output,`${route.split('/').at(-1)}-${theme}-${width}.png`)});
          captured = true;
        }
      }
      const overflow = await page.evaluate(() => ({ document:document.documentElement.scrollWidth, viewport:innerWidth, scrollers:[...document.querySelectorAll('*')].filter(el=>el.clientWidth>0 && /auto|scroll/.test(getComputedStyle(el).overflowY)).map(el=>({width:el.scrollWidth,client:el.clientWidth})) }));
      assert(overflow.document<=width+1 && overflow.scrollers.every(el=>el.width<=el.client+1), `Overflow ${route}/${theme}/${width}: ${JSON.stringify(overflow)}`);
      results.push({kind:'route',route,theme,width,stops,overflow});
      if (controlRoute && !captured) await page.screenshot({path:path.join(output,`${route.split('/').at(-1)}-${theme}-${width}.png`)});
      await page.close();
      console.log(`PASS ${route} ${theme}/${width}`);
    }
    const routeStops = results.filter(result=>result.kind==='route').flatMap(result=>result.stops);
    for (const role of ['link','tab','checkbox']) assert(routeStops.some(stop=>stop.role===role && stop.keyboard), `Natural Tab must reach a real page role=${role} control`);
    for (const tag of ['INPUT','TEXTAREA']) assert(routeStops.some(stop=>stop.tag===tag && stop.keyboard), `Natural Tab must reach a real page ${tag}`);
    for (const width of [390,768]) {
      const page = await openPage(browser,'/',width);
      const trigger='[aria-label="Open navigation"]';
      await page.click(trigger);
      await page.waitForSelector('[role="dialog"][aria-modal="true"]');
      await page.waitForFunction(()=>!!document.activeElement.closest('[role="dialog"]'));
      for(let step=0;step<30;step++) {
        await page.keyboard.press('Tab');
        assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')), 'Compact navigation must retain keyboard focus');
        assertRing(await activeObservation(page), `Compact navigation ${width}`);
      }
      await page.screenshot({path:path.join(output,`navigation-${width}.png`)});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
      await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Open navigation');
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open navigation','Escape must return focus to the trigger');
      await page.click(trigger);
      await page.waitForSelector('[aria-label="Close navigation menu"]');
      await page.click('[aria-label="Close navigation menu"]');
      await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
      await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Open navigation');
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open navigation','Close must return focus to the trigger');
      results.push({kind:'navigation',width,trap:true,escapeReturn:true,closeReturn:true});
      await page.close();
    }
    touchBrowser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
    const touch=await openPage(touchBrowser,'/',390,'light',false,true);
    await fixtures(touch);
    assert(!(await touch.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches)), 'Touch proof must not use the forced fine-pointer browser');
    await touch.hover('[data-focus-fixture="button"]');
    assert.equal(await touch.$eval('[data-focus-fixture="button"]',element=>getComputedStyle(element).transform),'none');
    results.push({kind:'touch',noHoverLift:true});
    await touch.close();
  }
  assert.deepEqual(errors, [], 'No browser console/runtime errors');
  console.log('Public control focus QA passed.');
} catch (error) {
  failure=error.message;
  const failedPage=(await browser.pages()).at(-1);
  if(failedPage && !failedPage.isClosed()) await failedPage.screenshot({path:path.join(output,'failure.png')});
  throw error;
} finally {
  await writeFile(path.join(output,'results.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:app,encoding:'utf8'}).trim(),utc:new Date().toISOString(),browser:browser.version(),results,errors,failure},null,2));
  await browser.close();
  if(touchBrowser) await touchBrowser.close();
  await new Promise(resolve=>server.close(resolve));
}
