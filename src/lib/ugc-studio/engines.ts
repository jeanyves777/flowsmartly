/**
 * UGC Studio render engine — generate creator takes with grok-imagine-video-1.5
 * IMAGE-to-video (a creator photo as the first frame + the script spoken with EXACT
 * lip-sync — verified word-for-word on our key). Reuses the Director's proven shape:
 * a bounded batch queue + drainer, an AWAITED provider-handle persist so a restart can
 * RESUME the render, credit charge up-front + refund on failure. Never throws to callers.
 */
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { prisma } from "@/lib/db/client";
import { getUgcProject, saveUgcProject, patchTake } from "./store";
import { clampDuration, normalizeTake, UGC_MAX_TAKES, type UgcProject, type UgcTake } from "./types";

const UGC_COST_KEY = "AI_VIDEO_LITE";            // an 8s grok clip — same tier as a Director AI scene
const UGC_MODEL = "grok-imagine-video-1.5";      // image-to-video, exact scripted lip-sync
const MAX_CONCURRENT_UGC = 4;
const TAKE_TIMEOUT_MS = 12 * 60 * 1000;
const TAKE_STALE_MS = 60_000;
const TAKE_REPOLL_MS = 20_000;
const TAKE_RESUME_MAX_MS = 25 * 60 * 1000;
const TAKE_NO_HANDLE_MS = 3 * 60 * 1000;

function uid(): string { return Math.random().toString(36).slice(2, 9); }
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

/** Build the lip-sync prompt: the person from the photo speaks the EXACT script. */
function ugcPrompt(project: UgcProject): string {
  const style = project.style || "Authentic";
  const script = (project.script || "").trim();
  return (
    `PHOTOREAL UGC creator video — a real person filmed on a phone camera; NOT 3D, NOT CGI, NOT animation. ` +
    `From the reference image of the person: they speak DIRECTLY to the viewer with natural facial expressions, ` +
    `head movement, subtle gestures and realistic LIP-SYNC. Style: ${style} UGC — casual and relatable, ` +
    `TikTok/Instagram Reels look, natural lighting, high realism, slight film grain, NOT overly polished. ` +
    `Handheld selfie-style framing with slight natural movement.\n` +
    `SCRIPT — spoken ALOUD and lip-synced, EXACTLY these words in this order, add nothing and change nothing: ` +
    `"${script}"\n` +
    `Make the lip movements perfectly synchronized with the spoken audio. Natural blinking and micro-expressions. ` +
    `Clean footage: absolutely NO on-screen text, captions, subtitles, watermarks or logos. Photorealistic, ${clampDuration(project.durationSec)} seconds.`
  );
}

/** Render ONE take (fire-and-forget). Charge happens in startTake; this refunds on failure. */
async function renderTake(projectId: string, userId: string, takeId: string, project: UgcProject): Promise<void> {
  const cost = await getDynamicCreditCost(UGC_COST_KEY).catch(() => 0);
  try {
    await patchTake(projectId, userId, takeId, { status: "rendering", progress: 8, renderStartedAt: Date.now(), renderHeartbeatAt: Date.now() });
    const started = Date.now();
    const result = await withTimeout(
      grokVideoClient.generateVideo(ugcPrompt(project), {
        model: UGC_MODEL,
        duration: clampDuration(project.durationSec),
        aspectRatio: project.aspect,
        resolution: "720p",
        imageUrl: project.photoUrl || undefined,   // 1.5 = image-to-video (first frame = the creator photo)
        timeoutMs: TAKE_TIMEOUT_MS,
        // AWAIT the handle write BEFORE the long poll so a restart can always resume (Director lesson).
        onJobId: async (rid) => { await patchTake(projectId, userId, takeId, { refKind: "grok", refId: rid }).catch(() => {}); },
        onStatus: () => {
          const elapsed = Date.now() - started;
          const est = 22 + Math.round((1 - Math.exp(-elapsed / (2.5 * 60 * 1000))) * 74);
          void patchTake(projectId, userId, takeId, { status: "rendering", progress: Math.min(96, Math.max(8, est)), renderHeartbeatAt: Date.now() }).catch(() => {});
        },
      }),
      TAKE_TIMEOUT_MS,
      "This take took too long and timed out.",
    );
    const url = await uploadToS3(`ugc/${projectId}/${takeId}-${uid()}.mp4`, result.videoBuffer, "video/mp4");
    await patchTake(projectId, userId, takeId, { status: "ready", progress: 100, videoUrl: url, thumbnailUrl: url, error: null });
  } catch (e) {
    if (cost > 0) {
      await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: cost, referenceType: "ugc_take", referenceId: takeId, description: "Refund: UGC take failed" }).catch(() => {});
    }
    console.error("[ugc-studio] take render failed:", e instanceof Error ? e.message : e);
    await patchTake(projectId, userId, takeId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  } finally {
    void drainUgcTakes(projectId, userId).catch(() => {}); // free slot → pull the next queued take
  }
}

/** Charge + kick a single take. Idempotent (skips one already rendering). */
async function startTake(projectId: string, userId: string, takeId: string): Promise<{ ok: boolean; message?: string }> {
  const project = await getUgcProject(projectId, userId);
  if (!project) return { ok: false, message: "Project not found." };
  const take = project.takes.find((t) => t.id === takeId);
  if (!take) return { ok: false, message: "Take not found." };
  if (take.status === "rendering") return { ok: true };
  if (!project.photoUrl) { await patchTake(projectId, userId, takeId, { status: "failed", error: "Add a creator photo to the brief first." }); return { ok: false, message: "Add a creator photo first." }; }
  if (!project.script?.trim()) { await patchTake(projectId, userId, takeId, { status: "failed", error: "Write a script first." }); return { ok: false, message: "Write a script first." }; }

  const cost = await getDynamicCreditCost(UGC_COST_KEY).catch(() => 0);
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) { await patchTake(projectId, userId, takeId, { status: "failed", error: block.message }); return { ok: false, message: block.message }; }
  if (cost > 0) {
    const charge = await creditService.deductCredits({
      userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
      referenceType: "ugc_take", referenceId: takeId, description: "UGC Studio — take",
      metadata: { feature: UGC_COST_KEY, projectId },
    });
    if (!charge.success) { await patchTake(projectId, userId, takeId, { status: "failed", error: charge.error || "Could not charge credits." }); return { ok: false, message: charge.error || "Could not charge credits." }; }
  }
  await patchTake(projectId, userId, takeId, { status: "rendering", progress: 6, error: null });
  void renderTake(projectId, userId, takeId, project); // fire-and-forget
  return { ok: true };
}

/** Kick up to the concurrency cap of QUEUED takes. Safe to call from a completion, poll, cron. */
export async function drainUgcTakes(projectId: string, userId: string, max = MAX_CONCURRENT_UGC): Promise<number> {
  const project = await getUgcProject(projectId, userId);
  if (!project) return 0;
  let active = project.takes.filter((t) => t.status === "rendering").length;
  const queued = project.takes.filter((t) => t.status === "queued").sort((a, b) => a.n - b.n);
  let started = 0;
  for (const t of queued) {
    if (active >= max) break;
    const res = await startTake(projectId, userId, t.id);
    if (res.ok) { active++; started++; }
    else if (/credit|insufficient|balance/i.test(res.message || "")) break; // out of credits — leave the rest queued
  }
  return started;
}

/** BATCH: append `count` queued takes and start the first few (drainer refills the rest). */
export async function generateTakes(projectId: string, userId: string, count: number): Promise<{ ok: boolean; queued: number; started: number; message?: string; project?: UgcProject }> {
  const project = await getUgcProject(projectId, userId);
  if (!project) return { ok: false, queued: 0, started: 0, message: "Project not found." };
  if (!project.photoUrl) return { ok: false, queued: 0, started: 0, message: "Add a creator photo to the brief first." };
  if (!project.script?.trim()) return { ok: false, queued: 0, started: 0, message: "Write a script first." };
  const n = Math.max(1, Math.min(UGC_MAX_TAKES, Math.round(count || 1)));
  const base = project.takes.length;
  for (let i = 0; i < n; i++) {
    const idx = base + i;
    project.takes.push(normalizeTake({ id: `take_${idx}_${uid()}`, n: idx + 1, x: 340 + (idx % 4) * 270, y: 110 + Math.floor(idx / 4) * 560, w: 236, status: "queued", progress: 0 }, idx));
  }
  await saveUgcProject(projectId, userId, project);
  const started = await drainUgcTakes(projectId, userId);
  const fresh = await getUgcProject(projectId, userId);
  return { ok: true, queued: n, started, project: fresh ?? project };
}

/** Regenerate a single existing take (redo). */
export async function regenerateTake(projectId: string, userId: string, takeId: string): Promise<{ ok: boolean; message?: string; project?: UgcProject }> {
  await patchTake(projectId, userId, takeId, { status: "queued", progress: 0, error: null, videoUrl: null, refId: undefined, refKind: undefined });
  const started = await drainUgcTakes(projectId, userId);
  const project = await getUgcProject(projectId, userId);
  return { ok: true, message: started ? undefined : "Queued", project: project ?? undefined };
}

// ── Resume (orphaned takes) + sync ────────────────────────────────────────────
async function resumeOrphanedTake(project: UgcProject, t: UgcTake, userId: string, now: number): Promise<boolean> {
  const lastBeat = t.renderHeartbeatAt || t.renderStartedAt || 0;
  if (now - lastBeat < TAKE_STALE_MS) return false; // a live worker is still on it
  const startedAgo = t.renderStartedAt ? now - t.renderStartedAt : Infinity;
  const failRefund = async (msg: string) => {
    t.status = "failed"; t.error = msg;
    const refund = await getDynamicCreditCost(UGC_COST_KEY).catch(() => 0);
    if (refund > 0) await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: refund, referenceType: "ugc_take", referenceId: t.id, description: "Refund: UGC take interrupted" }).catch(() => {});
  };
  if (!t.refId || t.refKind !== "grok") {
    if (startedAgo > TAKE_NO_HANDLE_MS) { await failRefund("This take was interrupted — please try again."); return true; }
    return false;
  }
  try {
    const st = await grokVideoClient.pollOnce(t.refId);
    if (st.state === "failed") { await failRefund(`This take couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`); return true; }
    if (st.state === "done" && st.url) {
      const buf = await grokVideoClient.fetchVideoBuffer(st.url);
      const url = await uploadToS3(`ugc/${project.id}/${t.id}-${uid()}.mp4`, buf, "video/mp4");
      t.status = "ready"; t.progress = 100; t.videoUrl = url; t.thumbnailUrl = url; t.error = null;
      return true;
    }
    if (startedAgo > TAKE_RESUME_MAX_MS) { await failRefund("This take took too long — please try again."); return true; }
    t.renderHeartbeatAt = now - (TAKE_STALE_MS - TAKE_REPOLL_MS); // re-poll in ~20s
    return true;
  } catch (e) {
    console.error(`[ugc-studio] take resume failed for ${t.id}:`, e instanceof Error ? e.message : e);
    if (startedAgo > TAKE_RESUME_MAX_MS) { await failRefund("This take couldn't be recovered — please try again."); return true; }
    return false;
  }
}

/** Called on project GET — resume any orphaned renders, then refill the queue. */
export async function syncUgcProject(project: UgcProject, userId: string): Promise<UgcProject> {
  const now = Date.now();
  let changed = false;
  for (const t of project.takes) {
    if (t.status === "rendering" && await resumeOrphanedTake(project, t, userId, now)) changed = true;
  }
  if (changed) await saveUgcProject(project.id, userId, project);
  if (project.takes.some((t) => t.status === "queued")) void drainUgcTakes(project.id, userId).catch(() => {});
  return project;
}

/** Cron entry (recover-tasks): resume/drain UGC projects even when no browser is open. */
export async function resumeStuckUgcTakes(): Promise<{ scanned: number; changed: number }> {
  const now = Date.now();
  const cutoff = new Date(now - TAKE_STALE_MS);
  let changed = 0;
  const rows = await prisma.design.findMany({
    where: { type: "ugc_project", updatedAt: { lt: cutoff } },
    select: { id: true, userId: true, canvasData: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  }).catch(() => [] as { id: string; userId: string; canvasData: string | null }[]);
  for (const row of rows) {
    if (!row.canvasData || (!row.canvasData.includes('"rendering"') && !row.canvasData.includes('"queued"'))) continue;
    const project = await getUgcProject(row.id, row.userId).catch(() => null);
    if (!project) continue;
    let touched = false;
    for (const t of project.takes) {
      if (t.status === "rendering" && await resumeOrphanedTake(project, t, row.userId, now)) touched = true;
    }
    if (touched) { await saveUgcProject(row.id, row.userId, project).catch(() => {}); changed++; }
    if (project.takes.some((t) => t.status === "queued")) { await drainUgcTakes(row.id, row.userId).catch(() => {}); changed++; }
  }
  return { scanned: rows.length, changed };
}
