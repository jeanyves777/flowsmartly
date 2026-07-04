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
body{margin:0;background:#0b1120;color:#e2e8f0;font:13px/1.4 Segoe UI,sans-serif;padding:18px}
h2{font-size:14px;margin:14px 0 8px;color:#a78bfa}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.c{background:#0f1729;border:1px solid #1e293b;border-radius:10px;overflow:hidden}
.c img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.ph{aspect-ratio:1;display:grid;place-items:center;color:#64748b}
.l{padding:6px 8px;font-weight:700;font-size:12px}
</style>
<h2>VARIANT A — model renders ALL the text (current approach = the bug)</h2>
<div class="grid">
${cell("A-xai.jpg","xAI · grok-imagine")}
${cell("A-nanobanana.png","Gemini · Nano Banana")}
${cell("A-imagen4ultra.png","Gemini · Imagen 4 Ultra")}
${cell("A-gptimage1.png","OpenAI · gpt-image-1")}
<div class="c"><div class="ph">—</div><div class="l">(gpt-image-2 A skipped)</div></div>
</div>
<h2>VARIANT B — clean background, NO baked text/logo (composite-fix approach)</h2>
<div class="grid">
${cell("B-xai.jpg","xAI · grok-imagine")}
${cell("B-nanobanana.png","Gemini · Nano Banana")}
${cell("B-imagen4ultra.png","Gemini · Imagen 4 Ultra")}
${cell("B-gptimage1.png","OpenAI · gpt-image-1")}
${cell("B-gptimage2.png","OpenAI · gpt-image-2")}
</div>`;
fs.writeFileSync(path.join(OUT, "sheet.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1500, height: 900, deviceScaleFactor: 1.5 });
await pg.goto("file:///" + path.join(OUT, "sheet.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: path.join(OUT, "sheet.png"), fullPage: true });
await b.close();
console.log("sheet done");
