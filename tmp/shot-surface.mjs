import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
try {
  await pg.goto("http://localhost:3001/surfaces/print", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/tmp/surface-print-top.png" });
  await pg.evaluate(() => window.scrollTo(0, 900));
  await new Promise((r) => setTimeout(r, 1200));
  await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/tmp/surface-print-gallery.png" });
  console.log("shots done");
} catch (e) { console.error("ERR", e.message); } finally { await b.close(); }
