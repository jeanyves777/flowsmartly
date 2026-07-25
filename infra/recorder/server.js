/**
 * FlowSmartly Training Room — recording bot.
 *
 * Runs on the MEDIA box (same host as infra/sfu, or its own). The web app calls this
 * service to start/stop a room recording; the bot then:
 *   1. asks the app for a hidden `isRecorder` seat + a guest cookie,
 *   2. opens a headless Chrome (in a virtual X display) on /m/<session> and renders the
 *      REAL live room — slides, AI narration, whiteboard, camera tiles,
 *   3. screen-records that display (video) + PulseAudio (the narration + everyone's audio)
 *      with ffmpeg → Full-HD H.264 / AAC in a fragmented MP4 (YouTube-ready),
 *   4. on stop, uploads the .mp4 to S3 and registers its URL back with the app.
 *
 * Nothing here is trusted from the internet: /start and /stop require the shared
 * TRAINING_RECORDER_SECRET header, and the app-facing calls carry the per-session recorder
 * ticket the app minted. See DEPLOY.md for the box setup (Chrome, ffmpeg, Xvfb, Pulse).
 */
const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const PORT = Number(process.env.RECORDER_PORT || 4600);
const SECRET = process.env.TRAINING_RECORDER_SECRET || "";
const APP_URL = (process.env.APP_URL || "https://flowsmartly.com").replace(/\/$/, "");
// Full-HD by default (YouTube-ready). Bump to 2560x1440 on a strong box for "super HD".
const W = Number(process.env.RECORDER_WIDTH || 1920);
const H = Number(process.env.RECORDER_HEIGHT || 1080);
const FPS = Number(process.env.RECORDER_FPS || 30);
const CHROME_PATH = process.env.CHROME_PATH || undefined; // system chromium if set
// H.264/MP4 output (plays everywhere + uploads straight to YouTube). x264 realtime settings are
// env-tunable so a weaker box can trade quality for speed (RECORDER_PRESET=ultrafast).
const V_PRESET = process.env.RECORDER_PRESET || "veryfast";
const V_CRF = process.env.RECORDER_CRF || "20"; // 18–23 = visually lossless→good; lower = bigger/better
const A_BITRATE = process.env.RECORDER_ABITRATE || "192k";

// S3 (the SAME bucket the app writes to — training/ is public)
const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_PUBLIC_URL = (process.env.S3_PUBLIC_URL || "").replace(/\/$/, "");
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
});

if (!SECRET) { console.error("[recorder] TRAINING_RECORDER_SECRET not set — refusing to start"); process.exit(1); }
if (!S3_BUCKET || !S3_PUBLIC_URL) { console.error("[recorder] S3_BUCKET / S3_PUBLIC_URL not set — refusing to start"); process.exit(1); }

/** sessionId -> job */
const jobs = new Map();
let nextDisplay = 99;

const once = (proc, ev) => new Promise((res) => proc.once(ev, res));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startJob(sessionId, token) {
  if (jobs.has(sessionId)) return; // already recording
  const display = `:${nextDisplay++}`;
  const hostname = new URL(APP_URL).hostname;
  const filePath = path.join(os.tmpdir(), `rec-${sessionId}-${process.pid}-${nextDisplay}.mp4`);
  const job = { display, filePath, token, xvfb: null, browser: null, ffmpeg: null, stopping: false };
  jobs.set(sessionId, job);

  try {
    // 1. virtual X display
    job.xvfb = spawn("Xvfb", [display, "-screen", "0", `${W}x${H}x24`, "-nolisten", "tcp"], { stdio: "ignore" });
    await sleep(1200);

    // 2. a hidden recorder seat + guest cookie (so /m/<id> renders the room for us)
    const join = await fetch(`${APP_URL}/api/ai/training/${sessionId}/recording/join`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-recorder-secret": SECRET },
      body: JSON.stringify({ token }),
    }).then((r) => r.json());
    if (!join?.success) throw new Error("join failed: " + (join?.error?.message || "?"));
    const guestToken = join.data.guestToken;

    // 3. headless-in-X Chrome, autoplay allowed, no real devices
    job.browser = await puppeteer.launch({
      headless: false, // a real window in the virtual display so ffmpeg can grab it
      executablePath: CHROME_PATH,
      args: [
        `--display=${display}`, `--window-size=${W},${H}`, "--window-position=0,0",
        "--kiosk", "--start-fullscreen", // no browser chrome — just the page, edge to edge
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream", // auto-accept mic/cam prompts (we don't produce)
        "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
        "--force-device-scale-factor=1", "--high-dpi-support=1",
        "--hide-scrollbars",
        // NB: do NOT pass --mute-audio at all. Chromium reads kMuteAudio with HasSwitch(), so even
        // "--mute-audio=false" MUTES (the switch is present) — it still opens the output stream and
        // pushes ZERO-filled frames, so the recording captured pure silence (-91 dB). Omit it entirely.
      ],
      env: { ...process.env, DISPLAY: display },
      defaultViewport: { width: W, height: H },
    });
    const page = (await job.browser.pages())[0] || (await job.browser.newPage());
    await page.setViewport({ width: W, height: H });
    await page.setCookie({ name: `tg_${sessionId}`, value: guestToken, domain: hostname, path: "/", httpOnly: true, secure: true });
    // rec=1 → the room renders a CLEAN, full-bleed stage (no roster / controls / chrome) for a
    // YouTube-ready video, and auto-unlocks audio so the narration is captured.
    await page.goto(`${APP_URL}/m/${sessionId}?rec=1`, { waitUntil: "networkidle2", timeout: 60000 });
    // a synthetic gesture in case anything still gates autoplay, then let it settle
    try { await page.mouse.click(Math.floor(W / 2), Math.floor(H / 2)); } catch {}
    await sleep(2500);

    // 4. record the display (video) + Pulse monitor (audio) → H.264/AAC in a FRAGMENTED mp4.
    //    Fragmented = a valid, playable, YouTube-uploadable file even if we're killed mid-record
    //    (raw mp4 would corrupt); yuv420p + faststart keep it universally decodable.
    job.ffmpeg = spawn("ffmpeg", [
      "-y", "-thread_queue_size", "1024",
      "-f", "x11grab", "-draw_mouse", "0", "-video_size", `${W}x${H}`, "-framerate", String(FPS), "-i", `${display}.0`,
      "-f", "pulse", "-thread_queue_size", "1024", "-i", process.env.PULSE_SOURCE || "default",
      "-c:v", "libx264", "-preset", V_PRESET, "-crf", V_CRF, "-pix_fmt", "yuv420p",
      "-g", String(FPS * 2), "-profile:v", "high", "-level", "4.2",
      "-c:a", "aac", "-b:a", A_BITRATE, "-ar", "48000", "-ac", "2",
      "-movflags", "+frag_keyframe+empty_moov+default_base_moof+faststart",
      "-f", "mp4", filePath,
    ], { stdio: ["pipe", "ignore", "ignore"] });

    console.log(`[recorder] recording ${sessionId} → ${filePath} (${display})`);
  } catch (e) {
    console.error(`[recorder] start ${sessionId} failed:`, e.message);
    await teardown(job);
    jobs.delete(sessionId);
    throw e;
  }
}

async function stopJob(sessionId) {
  const job = jobs.get(sessionId);
  if (!job || job.stopping) return;
  job.stopping = true;
  jobs.delete(sessionId);

  // finalize the file: 'q' asks ffmpeg to flush + write a valid trailer
  try { if (job.ffmpeg) { job.ffmpeg.stdin.write("q"); await Promise.race([once(job.ffmpeg, "close"), sleep(15000)]); } } catch {}
  await teardown(job);

  // upload + register (best-effort but logged loudly — a lost recording matters)
  try {
    const stat = fs.existsSync(job.filePath) ? fs.statSync(job.filePath) : null;
    if (!stat || stat.size < 1024) throw new Error("empty recording file");
    const key = `training/${sessionId}/recordings/${Date.now()}.mp4`;
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: fs.readFileSync(job.filePath), ContentType: "video/mp4" }));
    const url = `${S3_PUBLIC_URL}/${key}`;
    await fetch(`${APP_URL}/api/ai/training/${sessionId}/recording`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, token: job.token }),
    });
    console.log(`[recorder] saved ${sessionId} → ${url}`);
  } catch (e) {
    console.error(`[recorder] upload/register ${sessionId} failed:`, e.message);
  } finally {
    try { fs.unlinkSync(job.filePath); } catch {}
  }
}

/**
 * Self-test the WHOLE pipeline without a live room: open a test page (animated gradient + a 440 Hz
 * WebAudio tone), screen+audio record ~7s, upload to S3, return the public URL. Proves Xvfb →
 * Chrome → ffmpeg(x11grab+pulse) → S3 all work at the configured quality. Used by the admin panel.
 */
async function runSelfTest() {
  const display = `:${nextDisplay++}`;
  const filePath = path.join(os.tmpdir(), `selftest-${process.pid}-${Date.now()}.mp4`);
  let xvfb = null, browser = null;
  try {
    xvfb = spawn("Xvfb", [display, "-screen", "0", `${W}x${H}x24`, "-nolisten", "tcp"], { stdio: "ignore" });
    await sleep(1200);
    browser = await puppeteer.launch({
      headless: false, executablePath: CHROME_PATH,
      args: [`--display=${display}`, `--window-size=${W},${H}`, "--kiosk", "--start-fullscreen", "--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars"], // NO --mute-audio: HasSwitch() means its mere presence mutes (zero-filled frames → silent capture)
      env: { ...process.env, DISPLAY: display }, defaultViewport: { width: W, height: H },
    });
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.setViewport({ width: W, height: H });
    const html = "data:text/html," + encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#141024,#3a2f6b);color:#fff;font:800 4.5vw system-ui,sans-serif;text-align:center"><div>FlowSmartly recorder self-test<div id=t style="font:600 2vw system-ui;opacity:.8;margin-top:1vw"></div></div><script>const c=new(window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator(),g=c.createGain();g.gain.value=.04;o.frequency.value=440;o.connect(g).connect(c.destination);o.start();c.resume&&c.resume();let n=0;setInterval(()=>{document.getElementById('t').textContent=(++n)+'s · ${W}×${H} · audio+video';},1000);</script></body></html>`);
    await page.goto(html, { waitUntil: "load", timeout: 20000 });
    try { await page.mouse.click(Math.floor(W / 2), Math.floor(H / 2)); } catch {}
    await sleep(800);
    const ff = spawn("ffmpeg", [
      "-y", "-thread_queue_size", "1024",
      "-f", "x11grab", "-draw_mouse", "0", "-video_size", `${W}x${H}`, "-framerate", String(FPS), "-i", `${display}.0`,
      "-f", "pulse", "-thread_queue_size", "1024", "-i", process.env.PULSE_SOURCE || "default",
      "-t", "7",
      "-c:v", "libx264", "-preset", V_PRESET, "-crf", V_CRF, "-pix_fmt", "yuv420p", "-g", String(FPS * 2), "-profile:v", "high",
      "-c:a", "aac", "-b:a", A_BITRATE, "-ar", "48000", "-ac", "2",
      "-movflags", "+frag_keyframe+empty_moov+faststart", "-f", "mp4", filePath,
    ], { stdio: ["ignore", "ignore", "ignore"] });
    await Promise.race([once(ff, "close"), sleep(25000)]);
    try { ff.kill("SIGKILL"); } catch {}
  } finally {
    try { await browser?.close(); } catch {}
    try { xvfb?.kill("SIGKILL"); } catch {}
  }
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (!stat || stat.size < 2048) throw new Error("self-test produced an empty file (check Xvfb/ffmpeg/Pulse)");
  const key = `training/_selftest/${Date.now()}.mp4`;
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: fs.readFileSync(filePath), ContentType: "video/mp4" }));
  try { fs.unlinkSync(filePath); } catch {}
  return { url: `${S3_PUBLIC_URL}/${key}`, sizeBytes: stat.size, resolution: `${W}x${H}`, fps: FPS };
}

/** ABORT a recording: stop + DISCARD the file (never uploaded/registered). Used by the app's
 *  3-hour forgotten-recording cap — the clip is considered abandoned, so it isn't saved. */
async function abortJob(sessionId) {
  const job = jobs.get(sessionId);
  if (!job || job.stopping) return;
  job.stopping = true;
  jobs.delete(sessionId);
  try { job.ffmpeg?.kill("SIGKILL"); } catch {}
  await teardown(job);
  try { fs.unlinkSync(job.filePath); } catch {}
  console.log(`[recorder] aborted ${sessionId} (discarded — not saved)`);
}

async function teardown(job) {
  try { await job.browser?.close(); } catch {}
  try { job.ffmpeg?.kill("SIGKILL"); } catch {}
  try { job.xvfb?.kill("SIGKILL"); } catch {}
}

function readBody(req) {
  return new Promise((res) => { let s = ""; req.on("data", (c) => (s += c)).on("end", () => { try { res(JSON.parse(s || "{}")); } catch { res({}); } }); });
}

const server = http.createServer(async (req, res) => {
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.url === "/health") return json(200, { ok: true, jobs: jobs.size, sessions: [...jobs.keys()], resolution: `${W}x${H}`, fps: FPS });
  if (req.method !== "POST") return json(404, { error: "not found" });
  if (req.headers["x-recorder-secret"] !== SECRET) return json(401, { error: "unauthorized" });
  // pipeline self-test — no sessionId, exercises Xvfb+Chrome+ffmpeg+S3 end to end
  if (req.url === "/selftest") {
    try { const r = await runSelfTest(); return json(200, { ok: true, ...r }); }
    catch (e) { console.error("[recorder] selftest failed:", e.message); return json(500, { ok: false, error: String(e.message || e) }); }
  }
  const body = await readBody(req);
  const sessionId = String(body.sessionId || "");
  if (!sessionId) return json(400, { error: "sessionId required" });
  try {
    if (req.url === "/start") { await startJob(sessionId, String(body.token || "")); return json(200, { ok: true }); }
    if (req.url === "/stop") { void stopJob(sessionId); return json(200, { ok: true }); }
    if (req.url === "/abort") { void abortJob(sessionId); return json(200, { ok: true }); }
    return json(404, { error: "not found" });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => console.log(`[recorder] listening on :${PORT} (POST /start · /stop · GET /health)`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    console.log(`[recorder] ${sig} — finalizing ${jobs.size} recording(s)`);
    await Promise.all([...jobs.keys()].map(stopJob));
    process.exit(0);
  });
}
