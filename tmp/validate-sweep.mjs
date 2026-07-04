import puppeteer from "puppeteer";
const BASE = "http://localhost:3001";
const CREDS = { email: "test@flowsmartly.com", password: "Test@123456" };
const OUT = "d:/Flowsmartly/flowsmartly/tmp";

const SURFACES = [
  { view: "storyad", btn: /create a story-ad|new story-ad/i, expect: /creating your story-ad/i },
  { view: "email", btn: /draft with ai/i, expect: /drafting your campaign|setting up your campaign/i },
  { view: "sms", btn: /new sms blast|create a blast|new blast/i, expect: /writing your blast|setting up your blast/i },
  { view: "calendar", btn: /plan my week/i, expect: /planning your week/i },
  { view: "media", btn: /create with the agent/i, expect: /creating your images/i },
  { view: "delivery", btn: /create my store/i, expect: /setting up your store/i },
];

const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1360, height: 880, deviceScaleFactor: 1 });
pg.on("pageerror", () => {});
try {
  await pg.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  console.log("login:", await pg.evaluate(async (c) => (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })).status, CREDS));

  for (const s of SURFACES) {
    try {
      await pg.goto(`${BASE}/home/${s.view}`, { waitUntil: "networkidle0", timeout: 120000 });
      await new Promise((r) => setTimeout(r, 2200));
      const clicked = await pg.evaluate((re) => {
        const rx = new RegExp(re.source, re.flags);
        const btn = Array.from(document.querySelectorAll("button")).find((b) => rx.test(b.textContent || "") && b.offsetParent !== null && !b.disabled);
        if (btn) { btn.click(); return btn.textContent.trim().slice(0, 40); } return null;
      }, { source: s.btn.source, flags: s.btn.flags });
      await new Promise((r) => setTimeout(r, 800));
      const res = await pg.evaluate((re) => {
        const rx = new RegExp(re.source, re.flags);
        return { loaderText: rx.test(document.body.innerText), spinner: !!document.querySelector(".animate-spin, [class*='flow-loader'], svg.animate-spin") };
      }, { source: s.expect.source, flags: s.expect.flags });
      await pg.screenshot({ path: `${OUT}/sweep-${s.view}.png` });
      console.log(`${s.view.padEnd(10)} click=${clicked ? `"${clicked}"` : "NOT FOUND"} loaderShown=${res.loaderText}`);
    } catch (e) {
      console.log(`${s.view.padEnd(10)} ERROR ${e.message.slice(0, 60)}`);
    }
  }
  console.log("done");
} catch (e) { console.error("FATAL", e.message); } finally { await b.close(); }
