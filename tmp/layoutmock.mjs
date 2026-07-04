import fs from "node:fs";
import puppeteer from "puppeteer";

// Reproduce the agent-home shell nesting. `.viewport` = the real screen (100dvh).
// If the layout overflows it, `.viewport` gets a scrollbar and a red band shows
// below the composer — exactly the bug. `fix` adds `min-height:0` to `.main`.
function shell(fix) {
  const msgs = Array.from({ length: 24 }, (_, i) => `<div class="msg">Message ${i + 1}</div>`).join("");
  return `
  <div class="wrap">
    <h3>${fix ? "AFTER — main has min-h-0" : "BEFORE — main missing min-h-0"}</h3>
    <div class="viewport">
      <div class="root">
        <div class="header">header (topbar)</div>
        <div class="bodyrow">
          <div class="rail">rail</div>
          <main class="main ${fix ? "fix" : ""}">
            <div class="scroll">
              ${msgs}
              <div class="pb44"></div>
            </div>
            <div class="composer">Ask FlowSmartly to do something…</div>
          </main>
        </div>
      </div>
    </div>
  </div>`;
}

const html = `<!doctype html><meta charset=utf8><style>
  body{margin:0;background:#111827;font:13px Segoe UI,sans-serif;padding:20px;display:flex;gap:28px}
  h3{color:#a78bfa;font-size:12px;margin:0 0 8px;font-weight:700}
  /* .viewport simulates the browser window (a fixed 640px "100dvh"). overflow:auto
     so any spill BEYOND the frame shows as a scrollbar + reveals the pink area. */
  .viewport{width:360px;height:640px;overflow:auto;border:2px solid #ef4444;border-radius:6px;background:#ff2d6b22}
  .root{display:flex;flex-direction:column;height:640px;background:#0b0f1a}   /* h-[100dvh] */
  .header{flex:0 0 auto;height:52px;border-bottom:1px solid #1f2937;color:#e5e7eb;display:flex;align-items:center;padding:0 12px}
  .bodyrow{display:flex;flex:1 1 auto;min-height:0}                            /* flex min-h-0 flex-1 */
  .rail{flex:0 0 60px;border-right:1px solid #1f2937;color:#6b7280;display:flex;justify-content:center;padding-top:10px}
  .main{position:relative;display:flex;flex-direction:column;flex:1 1 auto;overflow-x:clip}  /* NO min-h-0 (bug) */
  .main.fix{min-height:0}                                                      /* the fix */
  .scroll{flex:1 1 auto;overflow-y:auto;padding:12px}                          /* flex-1 overflow-y-auto */
  .msg{background:#111a2e;border:1px solid #1f2937;border-radius:10px;padding:9px 11px;margin-bottom:8px;color:#cbd5e1}
  .pb44{height:176px}                                                          /* pb-44 reservation */
  .composer{position:absolute;left:0;right:0;bottom:0;height:60px;margin:10px;border:1px solid #334155;border-radius:12px;background:#0f172a;color:#94a3b8;display:flex;align-items:center;padding:0 14px}
</style>
${shell(false)}
${shell(true)}`;

fs.writeFileSync("d:/Flowsmartly/flowsmartly/tmp/layoutmock.html", html);
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 820, height: 760, deviceScaleFactor: 2 });
await pg.goto("file:///d:/Flowsmartly/flowsmartly/tmp/layoutmock.html", { waitUntil: "networkidle0" });
// Scroll each .viewport to the bottom to reveal any overflow band.
const overflow = await pg.$$eval(".viewport", (els) =>
  els.map((el) => {
    el.scrollTop = el.scrollHeight;
    return { scrollH: el.scrollHeight, clientH: el.clientHeight, overflow: el.scrollHeight - el.clientHeight };
  })
);
await pg.screenshot({ path: "d:/Flowsmartly/flowsmartly/tmp/layoutmock.png" });
await b.close();
console.log(JSON.stringify(overflow, null, 2));
