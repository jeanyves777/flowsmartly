import fs from "node:fs";
import puppeteer from "puppeteer";

const BASE = "http://localhost:3001";
const CREDS = { email: "test@flowsmartly.com", password: "Test@123456" };

const measureFn = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const de = document.documentElement, body = document.body;
  const all = Array.from(document.querySelectorAll("*"));
  function describe(el) {
    let cls = "";
    if (el.getAttribute) {
      const c = el.getAttribute("class") || "";
      cls = c ? "." + c.trim().split(/\s+/).slice(0, 5).join(".") : "";
    }
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + cls;
  }
  const scrollers = all
    .filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight - el.clientHeight > 4;
    })
    .map((el) => ({
      sel: describe(el),
      overflowY: getComputedStyle(el).overflowY,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      extraScroll: el.scrollHeight - el.clientHeight,
      rectH: Math.round(el.getBoundingClientRect().height),
    }))
    .sort((a, b) => b.extraScroll - a.extraScroll);
  const below = all
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter((x) => x.r.bottom > vh + 4 && x.r.height > 8)
    .sort((a, b) => b.r.bottom - a.r.bottom)
    .slice(0, 14)
    .map((x) => ({ sel: describe(x.el), top: Math.round(x.r.top), bottom: Math.round(x.r.bottom), height: Math.round(x.r.height) }));
  // tallest elements overall (to spot an oversized 100dvh chain)
  const tallest = all
    .map((el) => ({ el, h: el.getBoundingClientRect().height }))
    .filter((x) => x.h > vh * 0.5)
    .sort((a, b) => b.h - a.h)
    .slice(0, 12)
    .map((x) => ({ sel: describe(x.el), height: Math.round(x.h) }));
  return {
    vw, vh,
    deScrollH: de.scrollHeight,
    deClientH: de.clientHeight,
    bodyScrollH: body.scrollHeight,
    pageOverflow: Math.max(de.scrollHeight, body.scrollHeight) - vh,
    canScrollPage: Math.max(de.scrollHeight, body.scrollHeight) > vh + 4,
    scrollers,
    below,
    tallest,
  };
};

const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
pg.on("console", (m) => { const t = m.text(); if (/error|warn/i.test(t)) console.log("  [page]", t.slice(0, 140)); });

try {
  console.log("→ opening app + logging in via API…");
  await pg.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  const login = await pg.evaluate(async (creds) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creds) });
    let body = "";
    try { body = await r.text(); } catch {}
    return { status: r.status, body: body.slice(0, 300) };
  }, CREDS);
  console.log("  login status:", login.status, login.status === 200 ? "OK" : login.body);

  const report = {};
  for (const vp of [{ width: 1440, height: 820 }, { width: 1280, height: 720 }]) {
    await pg.setViewport({ ...vp, deviceScaleFactor: 1 });
    console.log(`→ /home @ ${vp.width}x${vp.height} …`);
    await pg.goto(BASE + "/home", { waitUntil: "networkidle0", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 2500)); // settle layout/fonts
    const m = await pg.evaluate(measureFn);
    report[`${vp.width}x${vp.height}`] = m;
    const tag = `${vp.width}x${vp.height}`;
    // scroll to bottom to expose any empty band, screenshot full page
    await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await new Promise((r) => setTimeout(r, 400));
    await pg.screenshot({ path: `d:/Flowsmartly/flowsmartly/tmp/home-${tag}-bottom.png` });
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.screenshot({ path: `d:/Flowsmartly/flowsmartly/tmp/home-${tag}-top.png` });
  }
  fs.writeFileSync("d:/Flowsmartly/flowsmartly/tmp/home-measure.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error("MEASURE ERROR:", e.message);
} finally {
  await b.close();
}
