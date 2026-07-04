import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 200, deviceScaleFactor: 2 });
await p.goto("file:///d:/Flowsmartly/flowsmartly/design/design-header-mock.html", { waitUntil: "networkidle0" });
await p.screenshot({ path: "design/design-header-mock.png" });
await b.close(); console.log("done");
