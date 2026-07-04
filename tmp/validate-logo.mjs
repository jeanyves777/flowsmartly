import puppeteer from "puppeteer";
const BASE = "http://localhost:3001";
const CREDS = { email: "test@flowsmartly.com", password: "Test@123456" };
const OUT = "d:/Flowsmartly/flowsmartly/tmp";

const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 120)));
try {
  await pg.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  console.log("login:", await pg.evaluate(async (c) => (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })).status, CREDS));
  await pg.goto(BASE + "/home/logo", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  await pg.screenshot({ path: `${OUT}/logo-before.png` });

  const clicked = await pg.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => /generate a logo/i.test(b.textContent || "") && b.offsetParent !== null);
    if (btn) { btn.click(); return true; } return false;
  });
  console.log("clicked Generate:", clicked);
  await new Promise((r) => setTimeout(r, 700));

  const state = await pg.evaluate(() => {
    const txt = document.body.innerText;
    const hasWorkingBtn = /working…/i.test(txt);
    const hasCard = /designing your logo concepts|setting up your logo|answer the agent/i.test(txt);
    const spinner = !!document.querySelector(".animate-spin");
    return { hasWorkingBtn, hasCard, spinner };
  });
  console.log("loader state after click:", JSON.stringify(state));
  await pg.screenshot({ path: `${OUT}/logo-after.png` });
  await new Promise((r) => setTimeout(r, 2500));
  await pg.screenshot({ path: `${OUT}/logo-after2.png` });
  console.log("done");
} catch (e) { console.error("ERR", e.message); } finally { await b.close(); }
