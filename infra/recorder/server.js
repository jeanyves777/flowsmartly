/**
 * FlowSmartly Training Room — recording bot.
 *
 * Runs on the MEDIA box (same host as infra/sfu, or its own). The web app calls this
 * service to start/stop a room recording; the bot then:
 *   1. asks the app for a hidden `isRecorder` seat + a guest cookie,
 *   2. opens a headless Chrome (in a virtual X display) on /m/<session> and renders the
 *      REAL live room — slides, AI narration, whiteboard, camera tiles,
 *   3. screen-records that display (video) + PulseAudio (the narration + everyone's audio)
 *      with ffmpeg,
 *   4. on stop, uploads the .webm to S3 and registers its URL back with the app.
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
const W = Number(process.env.RECORDER_WIDTH || 1280);
const H = Number(process.env.RECORDER_HEIGHT || 720);
const FPS = Number(process.env.RECORDER_FPS || 25);
const CHROME_PATH = process.env.CHROME_PATH || undefined; // system chromium if set

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
  const filePath = path.join(os.tmpdir(), `rec-${sessionId}-${process.pid}-${nextDisplay}.webm`);
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
        `--display=${display}`, `--window-size=${W},${H}`, "--window-position=0,0", "--start-fullscreen",
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream", // auto-accept mic/cam prompts (we don't produce)
        "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
        "--hide-scrollbars", "--mute-audio=false",
      ],
      env: { ...process.env, DISPLAY: display },
      defaultViewport: { width: W, height: H },
    });
    const page = (await job.browser.pages())[0] || (await job.browser.newPage());
    await page.setViewport({ width: W, height: H });
    await page.setCookie({ name: `tg_${sessionId}`, value: guestToken, domain: hostname, path: "/", httpOnly: true, secure: true });
    await page.goto(`${APP_URL}/m/${sessionId}`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(2500); // let the room settle + audio unlock

    // 4. record the display (video) + Pulse monitor (audio) → webm
    job.ffmpeg = spawn("ffmpeg", [
      "-y",
      "-f", "x11grab", "-draw_mouse", "0", "-video_size", `${W}x${H}`, "-framerate", String(FPS), "-i", `${display}.0`,
      "-f", "pulse", "-i", process.env.PULSE_SOURCE || "default",
      "-c:v", "libvpx", "-b:v", process.env.RECORDER_VBITRATE || "1800k", "-deadline", "realtime", "-cpu-used", "4",
      "-c:a", "libopus", "-b:a", "128k",
      filePath,
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
    const key = `training/${sessionId}/recordings/${Date.now()}.webm`;
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: fs.readFileSync(job.filePath), ContentType: "video/webm" }));
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
  if (req.url === "/health") return json(200, { ok: true, jobs: jobs.size });
  if (req.method !== "POST") return json(404, { error: "not found" });
  if (req.headers["x-recorder-secret"] !== SECRET) return json(401, { error: "unauthorized" });
  const body = await readBody(req);
  const sessionId = String(body.sessionId || "");
  if (!sessionId) return json(400, { error: "sessionId required" });
  try {
    if (req.url === "/start") { await startJob(sessionId, String(body.token || "")); return json(200, { ok: true }); }
    if (req.url === "/stop") { void stopJob(sessionId); return json(200, { ok: true }); }
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
