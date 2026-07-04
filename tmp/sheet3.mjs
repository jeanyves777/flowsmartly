import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const OUT = "d:/Flowsmartly/flowsmartly/design/bakeoff";
const EX = "d:/Flowsmartly/flowsmartly/DESIGN_ESAMPLE";
const img = (full, mime) => `data:${mime};base64,${fs.readFileSync(full).toString("base64")}`;
const cell = (full, mime, label) => `<div class="c"><img src="${img(full, mime)}"><div class="l">${label}</div></div>`;
const exFile = fs.readdirSync(EX).find((f) => /11_07_51.*\(1\)|11_02_31/.test(f)) || fs.readdirSync(EX)[3];
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#0b1120;color:#e2e8f0;font:14px Segoe UI,sans-serif;padding:18px}
h2{font-size:15px;margin:0 0 10px;color:#a78bfa}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.c{background:#0f1729;border:1px solid #1e293b;border-radius:12px;overflow:hidden}
.c img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.l{padding:8px 10px;font-weight:700;font-size:12px}
</style>
<h2>ROUND 3 — xAI at 2K, 3 art-direction recipes vs a gpt-image reference example</h2>
<div class="grid">
${cell(path.join(OUT, "R3-xai-v1-base2k.jpg"), "image/jpeg", "xAI v1 · base 2K")}
${cell(path.join(OUT, "R3-xai-v2-premium2k.jpg"), "image/jpeg", "xAI v2 · +premium polish 2K")}
${cell(path.join(OUT, "R3-xai-v3-premium2k.jpg"), "image/jpeg", "xAI v3 · +editorial layout 2K")}
${cell(path.join(EX, exFile), "image/png", "gpt-image EXAMPLE (target)")}
</div>`;
fs.writeFileSync(path.join(OUT, "sheet3.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1700, height: 600, deviceScaleFactor: 1.6 });
await pg.goto("file:///" + path.join(OUT, "sheet3.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: path.join(OUT, "sheet3.png"), fullPage: true });
await b.close();
console.log("sheet3 done, ex=", exFile);
