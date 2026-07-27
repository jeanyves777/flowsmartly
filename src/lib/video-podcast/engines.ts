/**
 * Video Podcast — ENGINES.
 *
 * Pipeline: draft the conversation (LLM, or parse the user's transcript) → render
 * each turn as a lip-synced clip (HeyGen Avatar IV off the speaker's photo avatar
 * + their voice) → compose the final by cutting, per turn, between a composited
 * 2-shot (speaker's live clip + the listener's still on a set backdrop) and a
 * single-speaker close-up → one stitched podcast.
 *
 * Photo avatars only lip-sync via Avatar IV (talking_photo), so every turn is an
 * Avatar-IV render regardless of quality tier — quality only changes output size.
 * Renders are single-flighted + heartbeat'd so a deploy can't double-charge or
 * strand a turn. [[clone-yourself-studio]] [[avatar-studio-heygen]]
 */
import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { getProject, saveProject, patchTurn, patchProject } from "./store";
import { podcastDims, wordBudget, parseTranscript, type PodcastProject, type PodcastTurn, type PodcastRole } from "./types";
import { ai } from "@/lib/ai/client";
import { heygenClient } from "@/lib/ai/heygen-client";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3, downloadS3ObjectToBuffer } from "@/lib/utils/s3-client";
import { concatenateVideoBuffers } from "@/lib/video/concat-videos";
import { fitClipTo, probeDurationSec } from "@/lib/video-director/clip-helpers";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable, type CreditCostKey } from "@/lib/credits/costs";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { saveToMediaLibrary } from "@/lib/ai/flow-agent/save-media";

// Photo avatars lip-sync via Avatar IV (photoreal, pricier); stock avatars use the
// standard talking engine. Charge per the engine each speaker actually uses.
const COST_PHOTO: CreditCostKey = "AI_AVATAR_VIDEO_PREMIUM"; // Avatar IV, per 30s
const COST_STOCK: CreditCostKey = "AI_AVATAR_VIDEO";         // standard talking, per 30s
const MAX_CONCURRENT = 2;                                    // HeyGen renders are slow; be gentle
const TURN_STALE_MS = 6 * 60_000;
const FINAL_BEAT_MS = 15_000;

function uid(): string { return Math.random().toString(36).slice(2, 10); }
const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

/** In-flight turn ids — a single-process (pm2 fork) lock so two racing drains can't
 *  render + CHARGE the same turn twice. On globalThis (routes bundle separately);
 *  resets on restart, which is when recovery should re-run. [[nextjs-inmemory-singleton-globalthis]] */
const RENDERING: Set<string> = ((globalThis as { __podcastRendering?: Set<string> }).__podcastRendering ??= new Set());

// ── credits ──
async function charge(userId: string, key: CreditCostKey, ref: string, seconds: number, meta: Record<string, unknown>): Promise<{ err: string | null; cost: number }> {
  const per30 = await getDynamicCreditCost(key).catch(() => 0);
  const cost = Math.max(per30, Math.ceil((Math.max(1, seconds) / 30) * per30));
  if (cost <= 0) return { err: null, cost: 0 };
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) return { err: block.message, cost: 0 };
  const res = await creditService.deductCredits({
    userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
    referenceType: "podcast", referenceId: ref, description: "Video Podcast — turn", metadata: { feature: key, ...meta },
  });
  return { err: res.success ? null : (res.error || "Could not charge credits."), cost: res.success ? cost : 0 };
}
async function refund(userId: string, amount: number, ref: string, why: string) {
  if (amount <= 0) return;
  await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount, referenceType: "podcast", referenceId: `${ref}:refund`, description: `Refund — ${why}` }).catch(() => {});
}

// ── ffmpeg ──
function ff(args: string[], timeoutMs = 300_000): Promise<void> {
  const bin = findFFmpegPath();
  if (!bin) return Promise.reject(new Error("Video assembly is not available on this server."));
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let err = "";
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    p.stderr.on("data", (c) => { err += c.toString(); if (err.length > 8000) err = err.slice(-8000); });
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (c) => { clearTimeout(t); c === 0 ? resolve() : reject(new Error(`ffmpeg (${c}): ${err.slice(-500)}`)); });
  });
}
async function toBuffer(url: string): Promise<Buffer> {
  try { return await downloadS3ObjectToBuffer(url); } catch { /* not ours / not S3 */ }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────── draft (script + backdrop)

interface DraftedTurn { speaker: string; text: string }

/** Write the two-person conversation (or parse the user's transcript), and render
 *  the set backdrop once. Fire-and-forget; the canvas polls draftStatus. */
export async function draftPodcast(id: string, userId: string): Promise<void> {
  await patchProject(id, userId, { draftStatus: "drafting", draftError: null, draftStartedAt: Date.now() }).catch(() => {});
  try {
    const p = await getProject(id, userId);
    if (!p) return;
    const hostName = p.host.name || "Host";
    const guestName = p.guest.name || "Guest";

    let pairs: { speaker: PodcastRole; text: string }[] = [];
    if (p.ownScript) {
      pairs = parseTranscript(p.brief, hostName, guestName);
    } else {
      const budget = wordBudget(p.durationMin);
      const styleLine = p.stylePreset === "interview" ? "Format: an INTERVIEW — the host asks sharp questions, the guest answers with depth and specifics."
        : p.stylePreset === "debate" ? "Format: a FRIENDLY DEBATE — the two respectfully disagree and push each other, landing on common ground."
        : p.stylePreset === "expert" ? "Format: an EXPERT BREAKDOWN — the guest explains, the host draws out clear, concrete takeaways for a lay audience."
        : "Format: a natural back-and-forth conversation.";
      const written = await ai.generateJSON<{ title?: string; turns?: DraftedTurn[] }>(
        `Write a natural, engaging two-person podcast conversation.\n` +
        `HOST is "${hostName}". GUEST is "${guestName}".\n` +
        `TONE: ${p.tone || "Conversational"}. ${styleLine}\n` +
        `TOPIC / BRIEF:\n${p.brief.slice(0, 4000)}\n\n` +
        `Structure it as a HOOK (grab attention), a MAIN DISCUSSION (examples, insight, back-and-forth), and a TAKEAWAY (summarise + next step). ` +
        `Rules: alternate speakers, start with the host welcoming, keep lines specific (no filler), end with one clear takeaway or call to action. ` +
        `Total spoken words across all turns must be about ${budget} (a ${p.durationMin}-minute episode). ` +
        `Return {"title":"short episode title","turns":[{"speaker":"host"|"guest","text":"spoken line"}]}.`,
        { maxTokens: 2200, temperature: 0.7 },
      );
      const title = typeof written?.title === "string" ? written.title.trim().slice(0, 160) : "";
      pairs = (written?.turns || [])
        .map((t) => ({ speaker: (t.speaker === "guest" ? "guest" : "host") as PodcastRole, text: String(t.text || "").trim() }))
        .filter((t) => t.text);
      if (title) await patchProject(id, userId, { title }).catch(() => {});
    }
    if (pairs.length === 0) throw new Error("No conversation could be built from that brief.");

    const turns: PodcastTurn[] = pairs.slice(0, 60).map((t, i) => ({
      id: `turn_${uid()}_${i}`, order: i, speaker: t.speaker, text: t.text.slice(0, 1200), status: "idle", progress: 0,
    }));

    // The set backdrop — one on-brand image reused behind every 2-shot. Best-effort.
    let backdropUrl: string | null = null;
    try {
      const { w, h } = podcastDims(p.aspect);
      const prompt = `A premium podcast studio set, EMPTY (no people): ${p.scene?.trim() || "a warm modern studio, wooden desk, soft key light, acoustic panels, subtle bokeh"}. ` +
        `Clean staging for two seats at a table. No text, no logos, no watermark.`;
      const res = await generateImageXaiFirst(prompt, w, h, { quality: "high", transparent: false });
      if (res.base64) backdropUrl = await uploadToS3(`podcast/${id}/backdrop-${uid()}.${res.format === "jpeg" ? "jpg" : res.format}`, Buffer.from(res.base64, "base64"), res.format === "jpeg" ? "image/jpeg" : `image/${res.format}`);
    } catch (e) { console.warn("[podcast] backdrop gen failed; using a plain set:", e instanceof Error ? e.message : e); }

    await patchProject(id, userId, { turns, backdropUrl, draftStatus: "ready", draftError: null });
  } catch (e) {
    console.error("[podcast] draft failed:", e);
    await patchProject(id, userId, { draftStatus: "failed", draftError: sanitizeUserError(e, "generic") }).catch(() => {});
  }
}

// ─────────────────────────────── per-turn render

export async function renderTurn(id: string, userId: string, turnId: string): Promise<void> {
  if (RENDERING.has(turnId)) return;
  RENDERING.add(turnId);
  let cost = 0;
  try {
    const p = await getProject(id, userId);
    if (!p) return;
    const turn = p.turns.find((t) => t.id === turnId);
    if (!turn) return;
    const sp = turn.speaker === "guest" ? p.guest : p.host;
    if (!sp.avatarId || !sp.voiceId) {
      await patchTurn(id, userId, turnId, { status: "failed", error: `Pick an avatar and a voice for the ${turn.speaker} first.` });
      return;
    }
    const aspect = p.aspect === "9:16" ? "9:16" : p.aspect === "1:1" ? "1:1" : "16:9";

    await patchTurn(id, userId, turnId, { status: "rendering", progress: 8, error: null, renderHeartbeatAt: Date.now() });

    // Estimate seconds from the line so the charge is proportional; the real clip
    // length is probed after render (HeyGen bills by output).
    const words = (turn.text.match(/\S+/g) || []).length;
    const estSec = Math.max(3, Math.round(words / 2.4));
    const costKey = sp.isPhoto ? COST_PHOTO : COST_STOCK;
    const charged = await charge(userId, costKey, `${id}:${turnId}:${uid()}`, estSec, { podcastId: id, turnId, speaker: turn.speaker });
    if (charged.err) { await patchTurn(id, userId, turnId, { status: "failed", error: charged.err }); return; }
    cost = charged.cost;

    const result = await heygenClient.generateAvatarVideo({
      avatarId: sp.avatarId,
      voiceId: sp.voiceId,
      script: turn.text,
      aspect,
      quality: sp.isPhoto ? "avatar_iv" : "standard",
      onJobId: async (vid) => { await patchTurn(id, userId, turnId, { refId: vid, renderHeartbeatAt: Date.now() }).catch(() => {}); },
      onProgress: (pct) => { void patchTurn(id, userId, turnId, { status: "rendering", progress: Math.min(96, Math.max(8, pct)), renderHeartbeatAt: Date.now() }).catch(() => {}); },
    });
    const clipUrl = await uploadToS3(`podcast/${id}/turn-${turnId}-${uid()}.mp4`, result.videoBuffer, "video/mp4");
    const realSec = (await probeDurationSec(result.videoBuffer)) ?? result.duration ?? estSec;
    await patchTurn(id, userId, turnId, { status: "ready", progress: 100, clipUrl, clipMs: Math.round(realSec * 1000), renderHeartbeatAt: Date.now() });
    await saveToMediaLibrary({
      userId, url: clipUrl, type: "video", mimeType: "video/mp4", size: result.videoBuffer.length,
      originalName: `podcast-${turn.speaker}-${turn.order + 1}.mp4`,
      tags: ["podcast", turn.speaker], metadata: { source: "video-podcast", projectId: id, turnId, speaker: turn.speaker },
    }).catch(() => {});
  } catch (e) {
    await refund(userId, cost, `${id}:${turnId}`, "podcast turn failed");
    console.error(`[podcast] turn ${turnId} failed:`, e);
    await patchTurn(id, userId, turnId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  } finally {
    RENDERING.delete(turnId);
    void drainTurns(id, userId).catch(() => {});
  }
}

export async function drainTurns(id: string, userId: string, max = MAX_CONCURRENT): Promise<number> {
  const p = await getProject(id, userId);
  if (!p) return 0;
  const live = p.turns.filter((t) => t.status === "rendering").length;
  const free = Math.max(0, max - live);
  if (free === 0) return 0;
  const next = p.turns.filter((t) => t.status === "queued" && !RENDERING.has(t.id)).slice(0, free);
  for (const t of next) {
    await patchTurn(id, userId, t.id, { status: "rendering", progress: 4, renderHeartbeatAt: Date.now() }).catch(() => {});
    void renderTurn(id, userId, t.id).catch(() => {});
  }
  return next.length;
}

export async function generateAllTurns(id: string, userId: string): Promise<{ ok: boolean; queued: number; message?: string }> {
  const p = await getProject(id, userId);
  if (!p) return { ok: false, queued: 0, message: "Not found" };
  if (!p.host.avatarId || !p.host.voiceId || !p.guest.avatarId || !p.guest.voiceId) {
    return { ok: false, queued: 0, message: "Give the host and guest an avatar and a voice first." };
  }
  const pending = p.turns.filter((t) => t.status !== "ready" && t.status !== "rendering");
  if (pending.length === 0) return { ok: true, queued: 0, message: "Every turn is done." };
  for (const t of pending) {
    const i = p.turns.findIndex((x) => x.id === t.id);
    p.turns[i] = { ...p.turns[i], status: "queued", progress: 0, error: null };
  }
  await saveProject(id, userId, p);
  await drainTurns(id, userId);
  return { ok: true, queued: pending.length };
}

// ─────────────────────────────── compose (cut + stitch)

/** Composite the SPEAKER's live clip and the LISTENER's still into a 2-shot on the
 *  set backdrop: host always sits left, guest right. Speaker audio drives it. */
async function twoShot(backdrop: Buffer | null, speakerClip: Buffer, listenerStill: Buffer, speaker: PodcastRole, w: number, h: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-pod-2s-"));
  try {
    const clipP = path.join(dir, "clip.mp4");
    const stillP = path.join(dir, "still.png");
    const outP = path.join(dir, "out.mp4");
    await writeFile(clipP, speakerClip);
    await writeFile(stillP, listenerStill);
    const seatW = Math.round(w * 0.46);
    const gap = Math.round(w * 0.04);
    const leftX = Math.round((w - seatW * 2 - gap) / 2);
    const rightX = leftX + seatW + gap;
    const y = Math.round(h * 0.12);
    const hostSpeaks = speaker === "host";
    // input 0 = backdrop (or lavfi color), 1 = speaker clip, 2 = listener still
    const bgArgs = backdrop ? (async () => { const bp = path.join(dir, "bg.png"); await writeFile(bp, backdrop); return ["-loop", "1", "-i", bp]; })() : Promise.resolve(["-f", "lavfi", "-i", `color=c=0x0c0f16:s=${w}x${h}`]);
    const bg = await bgArgs;
    const fc =
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[bg];` +
      `[1:v]scale=${seatW}:-1[sp];[2:v]scale=${seatW}:-1[li];` +
      (hostSpeaks
        ? `[bg][sp]overlay=${leftX}:${y}[t];[t][li]overlay=${rightX}:${y}[v]`
        : `[bg][li]overlay=${leftX}:${y}[t];[t][sp]overlay=${rightX}:${y}[v]`);
    await ff([
      ...bg, "-i", clipP, "-loop", "1", "-i", stillP,
      "-filter_complex", fc, "-map", "[v]", "-map", "1:a?",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", "-shortest", "-movflags", "+faststart", "-y", outP,
    ]);
    return await readFile(outP);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Stitch the ready turns into the final podcast. Fire-and-forget; poll finalStatus. */
export async function composePodcast(id: string, userId: string): Promise<void> {
  const beat = setInterval(() => { void patchProject(id, userId, { finalHeartbeatAt: Date.now() }).catch(() => {}); }, FINAL_BEAT_MS);
  try {
    await patchProject(id, userId, { finalStatus: "rendering", finalProgress: 5, finalHeartbeatAt: Date.now() });
    const p = await getProject(id, userId);
    if (!p) return;
    const { w, h } = podcastDims(p.aspect);
    const ordered = [...p.turns].sort((a, b) => a.order - b.order).filter((t) => t.status === "ready" && isUrl(t.clipUrl));
    if (ordered.length === 0) throw new Error("Render the turns before composing the podcast.");

    const backdrop = isUrl(p.backdropUrl) ? await toBuffer(p.backdropUrl).catch(() => null) : null;
    const hostStill = isUrl(p.host.portraitUrl) ? await toBuffer(p.host.portraitUrl).catch(() => null) : null;
    const guestStill = isUrl(p.guest.portraitUrl) ? await toBuffer(p.guest.portraitUrl).catch(() => null) : null;

    const segments: Buffer[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const t = ordered[i];
      const clip = await toBuffer(t.clipUrl as string).catch(() => null);
      if (!clip) continue;
      const dur = (t.clipMs || 4000) / 1000;
      // Auto: open on the 2-shot and return to it on hand-offs; otherwise close up on the speaker.
      const wantTwo = p.cutStyle === "two" || (p.cutStyle === "auto" && (i === 0 || i % 3 === 2));
      const listener = t.speaker === "host" ? guestStill : hostStill;
      let seg: Buffer | null = null;
      if (wantTwo && listener) {
        try { seg = await twoShot(backdrop, clip, listener, t.speaker, w, h); } catch (e) { console.warn("[podcast] 2-shot fell back to close-up:", e instanceof Error ? e.message : e); }
      }
      if (!seg) seg = await fitClipTo(clip, w, h, dur);
      segments.push(seg);
      await patchProject(id, userId, { finalStatus: "rendering", finalProgress: Math.min(92, 10 + Math.round(((i + 1) / ordered.length) * 80)), finalHeartbeatAt: Date.now() }).catch(() => {});
    }
    if (segments.length === 0) throw new Error("Could not assemble any turns.");

    const finalBuffer = segments.length === 1 ? segments[0] : await concatenateVideoBuffers(segments);
    const url = await uploadToS3(`podcast/${id}/final-${uid()}.mp4`, finalBuffer, "video/mp4");
    await patchProject(id, userId, { finalVideoUrl: url, finalStatus: "ready", finalProgress: 100, finalHeartbeatAt: Date.now() });
    await saveToMediaLibrary({
      userId, url, type: "video", mimeType: "video/mp4", size: finalBuffer.length,
      originalName: `${(p.title || "podcast").toLowerCase().replace(/\s+/g, "-").slice(0, 60)}.mp4`,
      tags: ["podcast", "episode"], metadata: { source: "video-podcast", projectId: id, host: p.host.name, guest: p.guest.name },
    }).catch(() => {});
  } catch (e) {
    console.error("[podcast] compose failed:", e);
    await patchProject(id, userId, { finalStatus: "failed", finalProgress: 0 }).catch(() => {});
  } finally {
    clearInterval(beat);
  }
}

// ─────────────────────────────── recovery (called on open)

/** Re-run anything a deploy/crash stranded: a stale draft, orphaned turns, a dead stitch. */
export async function resumeStuckPodcast(id: string, userId: string): Promise<void> {
  const p = await getProject(id, userId);
  if (!p) return;
  const now = Date.now();
  if (p.draftStatus === "drafting" && (!p.draftStartedAt || now - p.draftStartedAt > TURN_STALE_MS) && (p.draftTries || 0) < 2) {
    await patchProject(id, userId, { draftTries: (p.draftTries || 0) + 1 }).catch(() => {});
    void draftPodcast(id, userId).catch(() => {});
    return;
  }
  const stalled = p.turns.filter((t) => t.status === "rendering" && !RENDERING.has(t.id) && (!t.renderHeartbeatAt || now - t.renderHeartbeatAt > TURN_STALE_MS));
  for (const t of stalled) {
    await patchTurn(id, userId, t.id, { status: "queued", renderHeartbeatAt: now }).catch(() => {});
  }
  if (stalled.length) void drainTurns(id, userId).catch(() => {});
  if (p.finalStatus === "rendering" && (!p.finalHeartbeatAt || now - p.finalHeartbeatAt > TURN_STALE_MS) && (p.finalTries || 0) < 2) {
    await patchProject(id, userId, { finalTries: (p.finalTries || 0) + 1 }).catch(() => {});
    void composePodcast(id, userId).catch(() => {});
  }
}
