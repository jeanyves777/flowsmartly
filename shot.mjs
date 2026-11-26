import puppeteer from 'puppeteer';
import fs from 'node:fs';

const { jwt, adminToken } = JSON.parse(fs.readFileSync('D:/wt-credit/qa-auth.json','utf8'));
const BASE = 'http://localhost:3477';
const TAG = process.argv[2] || 'fixed';
const OUT = 'D:/wt-credit/shots';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--window-size=1440,1100'] });
const ctx = browser.defaultBrowserContext();

async function newPage(withAuth) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });
  if (withAuth) {
    await page.setCookie(
      { name: 'access_token', value: jwt, domain: 'localhost', path: '/' },
      { name: 'admin_token', value: adminToken, domain: 'localhost', path: '/' },
    );
  }
  page.on('console', m => { if (m.type()==='error') console.log('  [console.error]', m.text().slice(0,160)); });
  return page;
}

async function textHas(page, needle) {
  const body = await page.evaluate(() => document.body.innerText);
  return { found: body.includes(needle), body };
}

const results = [];

async function surface({ name, url, auth = true, waitFor, action, needles, file, scrollTo }) {
  const page = await newPage(auth);
  console.log(`\n=== ${name} → ${url}`);
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 180000 });
  } catch (e) { console.log('  goto:', e.message.slice(0,120)); }
  if (waitFor) {
    try { await page.waitForFunction(waitFor, { timeout: 120000 }); }
    catch (e) { console.log('  waitFor TIMEOUT:', e.message.slice(0,120)); }
  }
  if (action) { try { await action(page); } catch (e) { console.log('  action failed:', e.message.slice(0,200)); } }
  await new Promise(r => setTimeout(r, 1500));
  if (scrollTo) { try { await page.evaluate(scrollTo); await new Promise(r=>setTimeout(r,600)); } catch {} }
  const body = await page.evaluate(() => document.body.innerText);
  const hits = {};
  for (const n of needles) hits[n] = body.includes(n);
  const path = `${OUT}/${TAG}-${file}.png`;
  await page.screenshot({ path, fullPage: true });
  const url_ = page.url();
  console.log('  final url:', url_);
  console.log('  needles:', JSON.stringify(hits));
  console.log('  shot:', path);
  results.push({ name, url: url_, hits, path, bodyLen: body.length });
  fs.writeFileSync(`${OUT}/${TAG}-${file}.txt`, body);
  await page.close();
}

// 1. Terms (public)
await surface({
  name: 'S1 Terms of Service — Credit Value',
  url: '/terms', auth: false,
  waitFor: () => document.body.innerText.includes('Credit Value'),
  needles: ['1 credit = $0.05 USD', '1 credit = $0.01 USD'],
  file: 's1-terms',
  scrollTo: () => { const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()==='Credit Value:'); if(el) el.scrollIntoView({block:'center'}); },
});

// 2. SMS marketing settings footer
await surface({
  name: 'S2 SMS Marketing settings — pricing footer',
  url: '/settings/sms-marketing',
  waitFor: () => document.body.innerText.includes('Pricing:'),
  needles: ['1 credit = $0.05', '1 credit = $0.01'],
  file: 's2-sms-footer',
});

// 3. Admin credit pricing — open the edit modal
await surface({
  name: 'S3 Admin credit-pricing — edit modal cost line',
  url: '/admin/credit-pricing',
  waitFor: () => document.body.innerText.includes('Edit'),
  action: async (page) => {
    const btns = await page.$$('button');
    for (const b of btns) {
      const t = await page.evaluate(el => el.innerText.trim(), b);
      if (t === 'Edit') { await b.click(); break; }
    }
    await page.waitForFunction(() => document.body.innerText.includes('Credit Cost'), { timeout: 20000 });
  },
  needles: ['credits x $0.05', 'credits x $0.01', 'Credit Cost'],
  file: 's3-admin-credit-pricing',
});

// 4. Phone number rental
await surface({
  name: 'S4 Phone number rental — required credits',
  url: '/settings/sms-marketing/phone-number',
  waitFor: () => document.body.innerText.includes('Get a Phone Number'),
  needles: ['You need 500 credits', 'You need 100 credits', 'Insufficient Credits'],
  file: 's4-phone-number',
});

fs.writeFileSync(`${OUT}/${TAG}-results.json`, JSON.stringify(results, null, 1));
console.log('\n==== SUMMARY ====');
for (const r of results) console.log(r.name, '|', JSON.stringify(r.hits));
await browser.close();
