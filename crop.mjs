import puppeteer from 'puppeteer';
import fs from 'node:fs';
const TAG = process.argv[2] || 'fixed';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 3 });
await page.goto('http://localhost:3477/terms', { waitUntil: 'networkidle2', timeout: 180000 });
await page.waitForFunction(() => document.body.innerText.includes('Credit Value'), { timeout: 60000 });
const box = await page.evaluate(() => {
  const li = [...document.querySelectorAll('li')].find(e => e.innerText.trim().startsWith('Credit Value:'));
  if (!li) return null;
  const ul = li.closest('ul') || li;
  const sec = ul.parentElement;
  sec.scrollIntoView({ block: 'center' });
  const r = sec.getBoundingClientRect();
  return { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24, text: li.innerText };
});
console.log('clause text:', JSON.stringify(box?.text));
await new Promise(r => setTimeout(r, 800));
const box2 = await page.evaluate(() => {
  const li = [...document.querySelectorAll('li')].find(e => e.innerText.trim().startsWith('Credit Value:'));
  const sec = (li.closest('ul') || li).parentElement;
  const r = sec.getBoundingClientRect();
  return { x: Math.max(0, r.x + window.scrollX - 16), y: Math.max(0, r.y + window.scrollY - 16), width: Math.min(1280, r.width + 32), height: r.height + 32 };
});
await page.screenshot({ path: `D:/wt-credit/shots/${TAG}-s1-terms-CROP.png`, clip: box2 });
console.log('crop written', JSON.stringify(box2));
await browser.close();
