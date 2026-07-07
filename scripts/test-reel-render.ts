/**
 * test-reel-render.ts — validates the Reel Studio ffmpeg RENDER command
 * (9:16 center-crop → 1080x1920 + thumbnail) end-to-end, self-contained: it
 * generates a test source with ffmpeg, runs the exact filter/args used by
 * renderReelClip(), and asserts the output via ffprobe. No network, S3 or DB.
 *
 * Requires ffmpeg + ffprobe on PATH (or FFMPEG_PATH/FFPROBE_PATH). If ffmpeg is
 * absent it SKIPS (exit 0) — the prod render worker degrades the same way.
 *
 *   npx tsx scripts/test-reel-render.ts
 */
import { spawnSync } from "child_process";
import { promises as fsp, existsSync } from "fs";
import os from "os";
import path from "path";

const FF = process.env.FFMPEG_PATH || "ffmpeg";
const FP = process.env.FFPROBE_PATH || "ffprobe";
let pass = 0, fail = 0;
const ok = (m: string) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m: string) => { fail++; process.exitCode = 1; console.log(`  \x1b[31m✗ ${m}\x1b[0m`); };
const section = (t: string) => console.log(`\n\x1b[1m\x1b[36m${t}\x1b[0m`);

function ff(args: string[]) { const r = spawnSync(FF, args, { encoding: "utf8" }); if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || "").slice(-300)}`); }
function probeV(file: string, entry: string): string {
  const r = spawnSync(FP, ["-v", "error", "-select_streams", "v:0", "-show_entries", entry, "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  return (r.stdout || "").trim();
}

async function main() {
  const ver = spawnSync(FF, ["-version"], { encoding: "utf8" });
  if (ver.status !== 0) { console.log("ffmpeg not found — SKIPPING render validation (prod worker degrades the same way)."); return; }
  console.log((ver.stdout || "").split("\n")[0]);

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "reel-render-"));
  const input = path.join(dir, "input.mp4");
  const out = path.join(dir, "clip.mp4");
  const thumb = path.join(dir, "thumb.jpg");

  try {
    section("1. generate a 1280x720 test source (8s, video + audio)");
    ff(["-f", "lavfi", "-i", "testsrc=duration=8:size=1280x720:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-c:v", "libx264", "-c:a", "aac", "-shortest", "-y", input]);
    existsSync(input) ? ok("source created") : bad("source not created");

    section("2. render 9:16 clip [1s,5s] — the exact renderReelClip() command");
    const vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1";
    ff(["-ss", "1", "-i", input, "-t", "4", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", out]);
    const w = probeV(out, "stream=width"); const h = probeV(out, "stream=height");
    console.log(`   output ${w}x${h}`);
    w === "1080" ? ok("width is 1080") : bad(`width ${w} != 1080`);
    h === "1920" ? ok("height is 1920 (9:16 vertical)") : bad(`height ${h} != 1920`);
    const durS = spawnSync(FP, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", out], { encoding: "utf8" }).stdout.trim();
    const dur = parseFloat(durS);
    dur > 3.4 && dur < 4.7 ? ok(`duration ~4s (${dur.toFixed(2)}s)`) : bad(`duration ${durS}`);
    (await fsp.stat(out)).size > 1000 ? ok("mp4 has real bytes") : bad("mp4 too small");

    section("3. thumbnail (poster frame)");
    ff(["-ss", "1", "-i", out, "-frames:v", "1", "-y", thumb]);
    existsSync(thumb) && (await fsp.stat(thumb)).size > 0 ? ok("thumbnail generated") : bad("no thumbnail");

    section("4. speaker-aware reframe helper + offset crop");
    const py = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
    const reframe = spawnSync(py, [path.join(process.cwd(), "scripts", "reel-reframe.py"), input, "1", "5"], { encoding: "utf8" });
    let cx = NaN;
    try { cx = Number(JSON.parse((reframe.stdout || "").trim()).cx); } catch { /* invalid */ }
    Number.isFinite(cx) && cx >= 0 && cx <= 1 ? ok(`reframe.py returned a valid cx (${cx})`) : bad(`reframe.py cx invalid: ${(reframe.stdout || reframe.stderr || "").slice(0, 120)}`);
    const scaledW = Math.round((1920 * 1280) / 720);
    const offX = Math.max(0, Math.min(scaledW - 1080, Math.round((Number.isFinite(cx) ? cx : 0.5) * scaledW - 540)));
    const reframed = path.join(dir, "reframed.mp4");
    ff(["-ss", "1", "-i", input, "-t", "2", "-vf", `scale=-2:1920,crop=1080:1920:${offX}:0,setsar=1`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-an", "-y", reframed]);
    probeV(reframed, "stream=width") === "1080" && probeV(reframed, "stream=height") === "1920" ? ok(`speaker-crop produced 1080x1920 (x=${offX})`) : bad("speaker-crop wrong dims");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`\n${"─".repeat(46)}`);
  console.log(fail === 0 ? `\x1b[32m✓ RENDER PIPELINE VALIDATED\x1b[0m — ${pass} checks` : `\x1b[31m✗ ${fail} FAILED\x1b[0m, ${pass} passed`);
  console.log("─".repeat(46));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
