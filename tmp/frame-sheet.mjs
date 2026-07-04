import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const OUT = "d:/Flowsmartly/flowsmartly/design/bakeoff";
const cell = (f, label) => { const p = path.join(OUT, f); const b64 = fs.readFileSync(p).toString("base64"); return `<div class="c"><img src="data:image/jpeg;base64,${b64}"><div class="l">${label}</div></div>`; };
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#0b1120;color:#e2e8f0;font:13px Segoe UI,sans-serif;padding:16px}
h2{font-size:14px;margin:0 0 8px;color:#a78bfa}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.c{background:#0f1729;border:1px solid #1e293b;border-radius:10px;overflow:hidden}
.c img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.l{padding:7px 9px;font-weight:700;font-size:11.5px}
</style>
<h2>FRAME-CAUSE PROBE — same content, different framing language (xAI 2K). Look at the outer edges.</h2>
<div class="grid">
${cell("F0-flyer.jpg", "F0 · “flyer” (control)")}
${cell("F1-flyer-neg.jpg", "F1 · “flyer” + border negatives")}
${cell("F2-canvas-neg.jpg", "F2 · canvas-IS-artwork + negatives")}
${cell("F3-hero-neg.jpg", "F3 · website-hero + negatives")}
</div>`;
fs.writeFileSync(path.join(OUT, "frame-sheet.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1600, height: 560, deviceScaleFactor: 1.6 });
await pg.goto("file:///" + path.join(OUT, "frame-sheet.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: path.join(OUT, "frame-sheet.png"), fullPage: true });
await b.close();
console.log("done");
