import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const DIR = "d:/Flowsmartly/flowsmartly/public/print-mockups";
const tee = "data:image/webp;base64," + fs.readFileSync(path.join(DIR, "tee.webp")).toString("base64");
const mug = "data:image/webp;base64," + fs.readFileSync(path.join(DIR, "mug.webp")).toString("base64");
const hoodie = "data:image/webp;base64," + fs.readFileSync(path.join(DIR, "hoodie.webp")).toString("base64");
const cell = (img, color, label) => `<div class="c"><div class="p"><img src="${img}">${color ? `<div class="tint" style="background:${color};-webkit-mask-image:url('${img}');mask-image:url('${img}');-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat"></div>` : ""}</div><div class="l">${label}</div></div>`;
const stage = "background:radial-gradient(200px 130px at 40% 0%,#6d5cff22,transparent 70%),#0b1120";
const html = `<!doctype html><meta charset=utf8><style>body{margin:0;background:#0b1120;color:#e6ebf3;font:12px Segoe UI,sans-serif;padding:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.c{${stage};border:1px solid #1e293b;border-radius:10px;padding:10px}.p{position:relative}.p img{display:block;width:100%;filter:drop-shadow(0 16px 34px rgba(0,0,0,.5))}.tint{position:absolute;inset:0;mix-blend-mode:multiply}.l{margin-top:6px;font-weight:700;text-align:center}</style>
<div class=grid>
${cell(tee, null, "tee · white (base)")}
${cell(tee, "#1e3a8a", "tee · navy tint")}
${cell(tee, "#b91c1c", "tee · red tint")}
${cell(tee, "#166534", "tee · green tint")}
${cell(mug, null, "mug · white")}
${cell(mug, "#1e3a8a", "mug · navy tint")}
${cell(hoodie, null, "hoodie · gray (base)")}
${cell(hoodie, "#374151", "hoodie · charcoal tint")}
</div>`;
fs.writeFileSync(path.join(DIR, "tintcheck.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1000, height: 600, deviceScaleFactor: 1.6 });
await pg.goto("file:///" + path.join(DIR, "tintcheck.html").split(path.sep).join("/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/design/mockups-test/tintcheck.png", fullPage: true });
await b.close();
console.log("done");
