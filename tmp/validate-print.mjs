import puppeteer from "puppeteer";

const BASE = "http://localhost:3001";
const CREDS = { email: "test@flowsmartly.com", password: "Test@123456" };
const OUT = "d:/Flowsmartly/flowsmartly/tmp";

const clickByText = (page, text) =>
  page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll("button, a, [role=button]"));
    const hit = els.find((e) => e.textContent && e.textContent.includes(t) && e.offsetParent !== null);
    if (hit) { hit.click(); return true; }
    return false;
  }, text);

const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 160)));

try {
  await pg.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  const login = await pg.evaluate(async (c) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    return r.status;
  }, CREDS);
  console.log("login:", login);

  console.log("→ /home/print");
  await pg.goto(BASE + "/home/print", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));

  console.log("click Drinkware format:", await clickByText(pg, "Drinkware"));
  await new Promise((r) => setTimeout(r, 1800));

  // Click the Water bottle variant (title attr)
  const clickedBottle = await pg.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button[title]")).find((b) => b.getAttribute("title") === "Water bottle");
    if (btn) { btn.click(); return true; } return false;
  });
  console.log("click bottle variant:", clickedBottle);
  await new Promise((r) => setTimeout(r, 1400));
  await pg.screenshot({ path: `${OUT}/print-bottle.png` });

  // measure the bottle mockup image size
  const bottleSize = await pg.evaluate(() => {
    const img = Array.from(document.querySelectorAll("img")).find((i) => /bottle\.webp/.test(i.src));
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log("bottle rendered:", JSON.stringify(bottleSize));

  // NEW: the EMPTY print box should be draggable before any art is added
  const empty0 = await pg.evaluate(() => { const el = document.querySelector(".cursor-move.touch-none"); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; });
  console.log("empty box present:", JSON.stringify(empty0));
  if (empty0) {
    await pg.mouse.move(empty0.cx, empty0.cy);
    await pg.mouse.down();
    for (let i = 1; i <= 5; i++) { await pg.mouse.move(empty0.cx + 12 * i, empty0.cy - 6 * i); await new Promise((r) => setTimeout(r, 30)); }
    await pg.mouse.up();
    await new Promise((r) => setTimeout(r, 350));
    await pg.screenshot({ path: `${OUT}/print-empty-dragged.png` });
    const e1 = await pg.evaluate(() => { const el = document.querySelector(".cursor-move.touch-none"); const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; });
    console.log("empty box moved:", `${e1.x - empty0.x}px right, ${empty0.y - e1.y}px up`);
  }

  // Upload the test logo to place artwork
  const fileInput = await pg.$('input[type=file]');
  if (fileInput) { await fileInput.uploadFile(`${OUT}/testlogo.png`); console.log("uploaded logo"); }
  await new Promise((r) => setTimeout(r, 2500));
  await pg.screenshot({ path: `${OUT}/print-bottle-logo.png` });

  // find the draggable artwork + its box
  const before = await pg.evaluate(() => {
    const el = document.querySelector(".cursor-move.touch-none, .group.absolute.cursor-move");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) };
  });
  console.log("artwork box before drag:", JSON.stringify(before));

  // drag it up-left ~60px using real mouse input (fires pointer events)
  if (before) {
    await pg.mouse.move(before.cx, before.cy);
    await pg.mouse.down();
    for (let i = 1; i <= 6; i++) { await pg.mouse.move(before.cx - 10 * i, before.cy - 8 * i); await new Promise((r) => setTimeout(r, 30)); }
    await pg.mouse.up();
    await new Promise((r) => setTimeout(r, 400));
  }
  const after = await pg.evaluate(() => {
    const el = document.querySelector(".cursor-move.touch-none, .group.absolute.cursor-move");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y) };
  });
  console.log("artwork pos after drag:", JSON.stringify(after), "moved:", before && after ? `${before.x - after.x}px left, ${before.y - after.y}px up` : "n/a");
  await pg.screenshot({ path: `${OUT}/print-bottle-dragged.png` });

  // Also grab a tee shot for size comparison
  await pg.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button[title]")).find((b) => b.getAttribute("title") === "T-shirt");
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await pg.screenshot({ path: `${OUT}/print-tee.png` });
  console.log("done");
} catch (e) {
  console.error("VALIDATE ERROR:", e.message);
} finally {
  await b.close();
}
