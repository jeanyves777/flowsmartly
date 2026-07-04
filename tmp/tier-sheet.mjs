import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const OUT = "d:/Flowsmartly/flowsmartly/design/bakeoff";
const cell = (f, mime, label) => { const p = path.join(OUT, f); if (!fs.existsSync(p)) return `<div class="c"><div class="l">missing ${label}</div></div>`; return `<div class="c"><img src="data:${mime};base64,${fs.readFileSync(p).toString("base64")}"><div class="l">${label}</div></div>`; };
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#0b1120;color:#e2e8f0;font:14px Segoe UI,sans-serif;padding:18px}
h2{font-size:15px;margin:0 0 10px;color:#a78bfa}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.c{background:#0f1729;border:1px solid #1e293b;border-radius:12px;overflow:hidden}
.c img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.l{padding:8px 10px;font-weight:700;font-size:12.5px}
</style>
<h2>FINAL — both tiers through the real router + shipped recipe</h2>
<div class="grid">
${cell("TIER-standard.jpg", "image/jpeg", "STANDARD · xAI grok-imagine @2K")}
${cell("TIER-premium.png", "image/png", "PREMIUM · gpt-image-1")}
${cell("TIER-nanobanana.png", "image/png", "Standard fallback · Nano Banana")}
</div>`;
fs.writeFileSync(path.join(OUT, "tier-sheet.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1500, height: 640, deviceScaleFactor: 1.6 });
await pg.goto("file:///" + path.join(OUT, "tier-sheet.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: path.join(OUT, "tier-sheet.png"), fullPage: true });
await b.close();
console.log("done");
