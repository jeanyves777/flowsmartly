import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
const DIR = "d:/Flowsmartly/flowsmartly/public/print-mockups";
// [file, primary print area {l,t,w,h} as % of the image]
const items = [
  ["tee", { l: 54, t: 22, w: 15, h: 12 }, "left-chest"],
  ["tee-back", { l: 31, t: 16, w: 38, h: 44 }, "full-back"],
  ["hoodie", { l: 34, t: 36, w: 32, h: 22 }, "front"],
  ["hoodie-back", { l: 30, t: 26, w: 40, h: 40 }, "back"],
  ["vest", { l: 55, t: 30, w: 14, h: 10 }, "left-chest"],
  ["vest-back", { l: 30, t: 30, w: 40, h: 26 }, "back"],
  ["cap", { l: 35, t: 30, w: 30, h: 26 }, "front"],
  ["tote", { l: 28, t: 38, w: 44, h: 40 }, "center"],
  ["mug", { l: 22, t: 32, w: 38, h: 40 }, "wrap"],
  ["bottle", { l: 40, t: 34, w: 22, h: 34 }, "body"],
];
const cell = ([f, a, lbl]) => {
  const b64 = fs.readFileSync(path.join(DIR, f + ".webp")).toString("base64");
  return `<div class="c"><div class="wrap"><img src="data:image/webp;base64,${b64}"><div class="area" style="left:${a.l}%;top:${a.t}%;width:${a.w}%;height:${a.h}%"><span>${lbl}</span></div></div><div class="l">${f} · {l:${a.l},t:${a.t},w:${a.w},h:${a.h}}</div></div>`;
};
const html = `<!doctype html><meta charset=utf8><style>body{margin:0;background:#0b1120;color:#e6ebf3;font:12px Segoe UI,sans-serif;padding:14px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.c{background:radial-gradient(200px 130px at 40% 0%,#6d5cff22,transparent 70%),#0f1729;border:1px solid #1e293b;border-radius:10px;padding:8px}.wrap{position:relative}.wrap img{display:block;width:100%}.area{position:absolute;border:2px dashed #38bdf8dd;background:#38bdf818;border-radius:3px;display:grid;place-items:center}.area span{font-size:8px;font-weight:800;color:#7dd3fc}.l{margin-top:5px;font-size:9.5px;color:#94a3b8}</style><div class=grid>${items.map(cell).join("")}</div>`;
fs.writeFileSync(path.join(DIR, "areasheet.html"), html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1300, height: 640, deviceScaleFactor: 1.6 });
await pg.goto("file:///" + path.join(DIR, "areasheet.html").split(path.sep).join("/"), { waitUntil: "networkidle0" });
await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/design/mockups-test/areasheet.png", fullPage: true });
await b.close();
console.log("done");
