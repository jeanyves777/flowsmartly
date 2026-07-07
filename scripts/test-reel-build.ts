/**
 * test-reel-build.ts — a REAL, offline end-to-end test of the Reel Studio's
 * highlight pipeline (the pure core in src/lib/reel/highlights.ts). Mirrors
 * scripts/test-store-build.ts: a CLI harness with hand-rolled assertions that
 * sets `process.exitCode = 1` on any failure. No AI API calls, no credits, no
 * DB, no ffmpeg — it validates the deterministic scoring/clip logic that the
 * agent tool + UI depend on, so we can catch regressions before shipping.
 *
 *   npx tsx scripts/test-reel-build.ts            # run
 *   npx tsx scripts/test-reel-build.ts --verbose  # + dump the produced clips
 */

import { join } from "path";

const REPO_ROOT = join(__dirname, "..");
const VERBOSE = process.argv.slice(2).includes("--verbose");

const H = require(join(REPO_ROOT, "src/lib/reel/highlights")) as typeof import("../src/lib/reel/highlights");
const { buildReelClips, findHighlights, scoreMoment, coerceSettings, clipLengthBounds, DEFAULT_SETTINGS, REEL_CHANNELS } = H;

// ── tiny colored assert harness ───────────────────────────────────────────────
let passed = 0;
let failed = 0;
const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const c = (s: string) => `\x1b[36m${s}\x1b[0m`;
function section(t: string) { console.log(`\n\x1b[1m${c(t)}\x1b[0m`); }
function ok(msg: string) { passed++; console.log(`  ${g("✓")} ${msg}`); }
function fail(msg: string) { failed++; process.exitCode = 1; console.log(`  ${r("✗ " + msg)}`); }
function check(cond: boolean, msg: string) { cond ? ok(msg) : fail(msg); }

// ── fixture transcript (a realistic podcast: hooky moments + filler) ──────────
const seg = (start: number, end: number, text: string): H.TranscriptSegment => ({ start, end, text });
const TRANSCRIPT: H.Transcript = {
  segments: [
    seg(0, 14, "So, um, yeah, thanks for having me on the show. It's really great to be here, you know, I've been looking forward to this for a while."),
    seg(14, 40, "Everybody thinks you need a big ad budget to grow. You don't. I built a forty-thousand-a-month business with zero ad spend, and the whole thing ran on one channel nobody takes seriously."),
    seg(40, 64, "Firing my best client was the best decision I made all year. He paid the most, but he cost me every good idea I had."),
    seg(64, 90, "This exact three-email sequence got a sixty-one percent reply rate. The first email is one sentence, the second is a question, the third is proof."),
    seg(90, 108, "Anyway, like, we can get into the numbers later, um, I mean, it's kind of a long story honestly."),
    seg(108, 134, "Everyone says hire slow. They're wrong, and here's the proof: the best hire I ever made, I made in forty-eight hours."),
    seg(134, 150, "I don't wake up at five a.m. Here's what I do instead, and why it actually works better."),
    seg(150, 176, "The biggest pricing mistake I made cost me two hundred thousand dollars over two years. I was afraid to charge what it was worth."),
    seg(176, 190, "So that's, uh, kind of the background, you know, before we dive in."),
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
section("1. Scoring signal — hooky beats filler");
{
  const hooky = scoreMoment("I built a forty-thousand-a-month business with zero ad spend, and nobody talks about it.");
  const filler = scoreMoment("So um yeah, you know, it's kind of a long story, anyway, like, I mean.");
  check(hooky > filler, `hooky (${hooky}) scores higher than filler (${filler})`);
  check(hooky >= 55, `hooky score is strong (${hooky} ≥ 55)`);
  check(scoreMoment("too short") === 0, "sub-4-word text scores 0");
  check(scoreMoment("").toString() === "0", "empty text scores 0");
}

section("2. Pipeline — transcript → scored 9:16 clips");
const settings = coerceSettings({ clipLength: "short", count: 6 });
const clips = buildReelClips(TRANSCRIPT, settings);
const [minLen, maxLen] = clipLengthBounds(settings.clipLength);
if (VERBOSE) {
  for (const cl of clips) console.log(`     ${String(cl.score).padStart(2)} · ${cl.durationSec}s · ${cl.title}`);
}
check(clips.length > 0, `produced ${clips.length} clips`);
check(clips.length <= settings.count, `respects requested count (${clips.length} ≤ ${settings.count})`);
check(clips.every((cl) => cl.durationSec >= minLen - 0.01 && cl.durationSec <= maxLen + 0.01), `every clip is within [${minLen},${maxLen}]s`);
check(clips.every((cl) => cl.score >= 0 && cl.score <= 99), "every score is in 0-99");
check(clips.every((cl) => cl.aspect === "9:16"), "every clip is 9:16");

section("3. Selection quality");
{
  // Non-overlapping time ranges.
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);
  let overlap = false;
  for (let i = 1; i < sorted.length; i++) if (sorted[i].startSec < sorted[i - 1].endSec) overlap = true;
  check(!overlap, "clips do not overlap in time");

  // Sorted by score descending.
  const desc = clips.every((cl, i) => i === 0 || clips[i - 1].score >= cl.score);
  check(desc, "clips are returned sorted by score (desc)");

  // The strongest fixture moment surfaces near the top.
  check(clips[0].score >= 60, `top clip is high-scoring (${clips[0].score} ≥ 60)`);
  const hasZeroAdSpend = clips.some((cl) => (cl.transcriptText || "").toLowerCase().includes("zero ad spend"));
  check(hasZeroAdSpend, "the '$40k / zero ad spend' moment was selected");

  // Filler was NOT selected as a top clip.
  const fillerSelected = clips.some((cl) => (cl.transcriptText || "").toLowerCase().startsWith("so that's, uh"));
  check(!fillerSelected, "low-value filler was not selected");
}

section("4. Clip content shape");
check(clips.every((cl) => cl.title.trim().length > 0), "every clip has a non-empty title");
check(clips.every((cl) => cl.hashtags.length >= 1), "every clip has ≥1 hashtag");
check(clips.every((cl) => cl.caption.length > 0), "every clip has caption words");
check(
  clips.every((cl) => cl.caption[cl.caption.length - 1].t <= cl.durationSec + 0.5),
  "caption word timings stay within the clip duration",
);
check(clips.every((cl) => cl.renderStatus === "pending"), "clips start with renderStatus 'pending' (render is the ffmpeg worker's job)");

section("5. Different length preset (mid = 30-60s)");
{
  const midClips = buildReelClips(TRANSCRIPT, coerceSettings({ clipLength: "mid", count: 4 }));
  const [lo, hi] = clipLengthBounds("mid");
  check(midClips.length > 0, `mid preset produced ${midClips.length} clips`);
  check(midClips.every((cl) => cl.durationSec >= lo - 0.01 && cl.durationSec <= hi + 0.01), `every mid clip is within [${lo},${hi}]s`);
}

section("6. Edge cases + settings coercion");
check(findHighlights({ segments: [] }, DEFAULT_SETTINGS).length === 0, "empty transcript → 0 highlights");
check(buildReelClips({ segments: [] }, DEFAULT_SETTINGS).length === 0, "empty transcript → 0 clips");
{
  const clamped = coerceSettings({ count: 100, aspect: "banana", clipLength: "nope" });
  check(clamped.count === 12, "count clamps to 12");
  check(clamped.aspect === "9:16", "invalid aspect → 9:16 default");
  check(clamped.clipLength === DEFAULT_SETTINGS.clipLength, "invalid clipLength → default");
  const zero = coerceSettings({ count: 0 });
  check(zero.count === DEFAULT_SETTINGS.count, "count 0 → default");
}

section("7. Publish channels catalogue");
check(REEL_CHANNELS.length >= 5, `${REEL_CHANNELS.length} reel-capable channels defined`);
check(REEL_CHANNELS.filter((ch) => ch.nativeReels).length >= 4, "≥4 channels support native reels/shorts");

// ── summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(48)}`);
if (failed === 0) {
  console.log(`${g("✓ ALL PASSED")} — ${passed} checks`);
} else {
  console.log(`${r(`✗ ${failed} FAILED`)}, ${passed} passed`);
}
console.log(`${"─".repeat(48)}\n`);
