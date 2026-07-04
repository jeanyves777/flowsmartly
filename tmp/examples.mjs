import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const DIR = "d:/Flowsmartly/flowsmartly/DESIGN_ESAMPLE";
const files = fs.readdirSync(DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).sort();
const cells = files.map((f, i) => {
  const b64 = fs.readFileSync(path.join(DIR, f)).toString("base64");
  const mime = f.endsWith(".jpg") || f.endsWith(".jpeg") ? "image/jpeg" : f.endsWith(".webp") ? "image/webp" : "image/png";
  return `<div class="c"><img src="data:${mime};base64,${b64}"><div class="l">#${i + 1}</div></div>`;
}).join("");
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#0b1120;color:#e2e8f0;font:13px Segoe UI,sans-serif;padding:16px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.c{position:relative;background:#0f1729;border:1px solid #1e293b;border-radius:10px;overflow:hidden}
.c img{display:block;width:100%}
.l{position:absolute;top:6px;left:6px;background:#000a;padding:2px 7px;border-radius:6px;font-weight:700}
</style><div class="grid">${cells}</div>`;
fs.writeFileSync(path.join(DIR, "..", "tmp", "examples-sheet.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.4 });
await pg.goto("file:///d:/Flowsmartly/flowsmartly/tmp/examples-sheet.html", { waitUntil: "networkidle0" });
await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/tmp/examples-sheet.png", fullPage: true });
await b.close();
console.log("done", files.length, "files");
