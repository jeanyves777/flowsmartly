import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const DIR = "d:/Flowsmartly/flowsmartly/public/print-mockups";
const files = ["tee", "hoodie", "vest", "cap", "tote", "mug", "bottle"];
const cell = (f, bg) => {
  const p = path.join(DIR, f + ".png");
  const b64 = fs.readFileSync(p).toString("base64");
  return `<div class="c" style="${bg}"><img src="data:image/png;base64,${b64}"><div class="l">${f}</div></div>`;
};
const check = "background-image:linear-gradient(45deg,#334155 25%,transparent 25%),linear-gradient(-45deg,#334155 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#334155 75%),linear-gradient(-45deg,transparent 75%,#334155 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0px;background-color:#475569";
const stage = "background:radial-gradient(300px 200px at 40% 0%, #6d5cff22, transparent 70%), #0b1120";
const html = `<!doctype html><meta charset=utf8><style>body{margin:0;background:#0b1120;color:#e6ebf3;font:13px Segoe UI,sans-serif;padding:16px}h3{color:#a78bfa;margin:14px 0 8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.c{border-radius:10px;overflow:hidden;position:relative}.c img{display:block;width:100%;aspect-ratio:1;object-fit:contain}.l{position:absolute;bottom:4px;left:6px;background:#000a;padding:1px 6px;border-radius:5px;font-weight:700;font-size:11px}</style>
<h3>Transparent cutouts on checkerboard (see edges)</h3><div class="grid">${files.map((f) => cell(f, check)).join("")}</div>
<h3>On the Print Studio dark stage</h3><div class="grid">${files.map((f) => cell(f, stage)).join("")}</div>`;
fs.writeFileSync(path.join(DIR, "cutsheet.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1.5 });
await pg.goto("file:///" + path.join(DIR, "cutsheet.html").split(path.sep).join("/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/design/mockups-test/cutsheet.png", fullPage: true });
await b.close();
console.log("done");
