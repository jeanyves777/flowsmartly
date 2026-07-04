import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const OUT = "d:/Flowsmartly/flowsmartly/design/bakeoff";
const cell = (f, label) => {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) return `<div class="c"><div class="ph">missing</div><div class="l">${label}</div></div>`;
  const b64 = fs.readFileSync(p).toString("base64");
  const mime = f.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return `<div class="c"><img src="data:${mime};base64,${b64}"><div class="l">${label}</div></div>`;
};
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#0b1120;color:#e2e8f0;font:14px Segoe UI,sans-serif;padding:18px}
h2{font-size:15px;margin:0 0 10px;color:#a78bfa}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.c{background:#0f1729;border:1px solid #1e293b;border-radius:12px;overflow:hidden}
.c img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.ph{aspect-ratio:1;display:grid;place-items:center;color:#64748b}
.l{padding:8px 10px;font-weight:700}
</style>
<h2>ROUND 2 — art-directed recipe (full-bleed anti-card + rich layout). Target: DESIGN_ESAMPLE quality.</h2>
<div class="grid">
${cell("R2-xai.jpg","xAI · grok-imagine (STANDARD)")}
${cell("R2-nanobanana.png","Gemini · Nano Banana (STANDARD)")}
${cell("R2-gptimage1.png","OpenAI · gpt-image-1 (PREMIUM)")}
</div>`;
fs.writeFileSync(path.join(OUT, "sheet2.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1500, height: 700, deviceScaleFactor: 1.6 });
await pg.goto("file:///" + path.join(OUT, "sheet2.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: path.join(OUT, "sheet2.png"), fullPage: true });
await b.close();
console.log("sheet2 done");
