import puppeteer from 'puppeteer';
import fs from 'node:fs';
const { jwt } = JSON.parse(fs.readFileSync('D:/wt-credit/qa-auth.json','utf8'));
const TAG = process.argv[2];
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 3 });
await page.setCookie({ name:'access_token', value: jwt, domain:'localhost', path:'/' });
await page.goto('http://localhost:3477/settings/sms-marketing/phone-number', { waitUntil:'networkidle2', timeout:180000 });
await page.waitForFunction(() => document.body.innerText.includes('Insufficient Credits'), { timeout: 60000 }).catch(e=>console.log('no alert:', e.message.slice(0,80)));
await new Promise(r=>setTimeout(r,1200));
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => e.innerText && e.innerText.includes('Insufficient Credits') && e.getAttribute('role')==='alert');
  const t = el || [...document.querySelectorAll('div')].find(e => e.innerText && e.innerText.startsWith('Insufficient Credits'));
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return { x: Math.max(0,r.x+scrollX-14), y: Math.max(0,r.y+scrollY-14), width: r.width+28, height: r.height+28, text: t.innerText };
});
console.log('ALERT TEXT:', JSON.stringify(box?.text));
if (box) { const {text, ...c} = box; await page.screenshot({ path:`D:/wt-credit/shots/${TAG}-s4-alert-CROP.png`, clip: c }); console.log('crop ok'); }
await page.screenshot({ path:`D:/wt-credit/shots/${TAG}-s4-c50-full.png`, fullPage:true });
await browser.close();
