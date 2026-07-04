import puppeteer from "puppeteer";
const BASE = "http://localhost:3002";
const CREDS = { email: "test@flowsmartly.com", password: "Test@123456" };
const OUT = "d:/Flowsmartly/flowsmartly/tmp";
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0,140)));
try {
  await pg.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  console.log("login:", await pg.evaluate(async (c) => (await fetch("/api/auth/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c)})).status, CREDS));
  await pg.goto(BASE + "/home/voice", { waitUntil: "networkidle0", timeout: 180000 });
  await new Promise(r=>setTimeout(r,3500));
  await pg.screenshot({ path: `${OUT}/live-voice-create.png` });
  const clicked = await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/my voices/i.test(x.textContent||'')); if(b){b.click();return true;}return false;});
  await new Promise(r=>setTimeout(r,1500));
  await pg.screenshot({ path: `${OUT}/live-voice-voices.png` });
  console.log("my voices tab:", clicked, "done");
} catch(e){ console.error("ERR", e.message); } finally { await b.close(); }
