import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 640, height: 720, deviceScaleFactor: 2 });
await p.goto("file:///d:/Flowsmartly/flowsmartly/design/print-stage-mock.html", { waitUntil: "networkidle0" });
await new Promise(r=>setTimeout(r,400));
await p.screenshot({ path: "design/print-stage-mock.png", fullPage: true });
await b.close(); console.log("done");
