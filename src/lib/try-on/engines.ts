/**
 * Virtual Try-on render engine — animate a fashion look from TWO references:
 * (1) the person, (2) the outfit. Uses grok-imagine-video REFERENCE-to-video (verified:
 * 2 refs, 3:4, 6s -> 720x960 with audio), NOT the 1.5 image-to-video path, because the
 * model must RE-DRESS the person rather than animate a single frame. Same proven batch
 * queue + drainer + resume + charge/refund shape as the other studios.
 */
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { prisma } from "@/lib/db/client";
import { getTryOnProject, saveTryOnProject, patchTryOnTake } from "./store";
import { clampTryOnDuration, normalizeTryOnTake, TRYON_MAX_TAKES, type TryOnProject, type TryOnTake } from "./types";

const TRYON_COST_KEY = "AI_VIDEO_LITE";
const TRYON_MODEL = "grok-imagine-video";   // reference-to-video (NOT 1.5)
const MAX_CONCURRENT_TRYON = 4;
const TAKE_TIMEOUT_MS = 12 * 60 * 1000;
const TAKE_STALE_MS = 60_000;
const TAKE_REPOLL_MS = 20_000;
const TAKE_RESUME_MAX_MS = 25 * 60 * 1000;
const TAKE_NO_HANDLE_MS = 3 * 60 * 1000;

function uid(): string { return Math.random().toString(36).slice(2, 9); }
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

/** Reference 1 = the person (keep them), reference 2 = the outfit (put it on them). */
function tryOnPrompt(project: TryOnProject): string {
  const body = (project.prompt || "").trim();
  return (
    `PHOTOREAL fashion film — a real person filmed on a cinema camera; NOT 3D, NOT CGI, NOT animation. ` +
    `The person is EXACTLY the one in reference image 1: keep their face, hair, skin tone, body and proportions identical. ` +
    `Their clothes have been REPLACED by the outfit in reference image 2 — match that garment's exact cut, colour, pattern, fabric and details, worn naturally and fitted to their body with realistic drape and folds.\n` +
    (body ? `MOTION & SCENE — ${body}\n` : `MOTION & SCENE — the person walks slowly toward camera with a natural stride and subtle fabric movement.\n`) +
    `Cinematic shallow depth of field, soft key light, commercial fashion video quality. Natural continuous motion with correct anatomy — no distorted or morphing faces, no extra or fused fingers, no warping garments. ` +
    `Clean footage: absolutely NO on-screen text, captions, watermarks or logos, and no readable gibberish text on the clothing.`
  );
}

async function renderTryOnTake(projectId: string, userId: string, takeId: string, project: TryOnProject): Promise<void> {
  const cost = await getDynamicCreditCost(TRYON_COST_KEY).catch(() => 0);
  try {
    await patchTryOnTake(projectId, userId, takeId, { status: "rendering", progress: 8, renderStartedAt: Date.now(), renderHeartbeatAt: Date.now() });
    const started = Date.now();
    const refs = [project.personImageUrl, project.outfitImageUrl].filter((u): u is string => !!u);
    const result = await withTimeout(
      grokVideoClient.generateVideo(tryOnPrompt(project), {
        model: TRYON_MODEL,
        duration: clampTryOnDuration(project.durationSec),
        aspectRatio: project.aspect,
        resolution: "720p",
        referenceImageUrls: refs,   // reference-to-video: [person, outfit]
        timeoutMs: TAKE_TIMEOUT_MS,
        onJobId: async (rid) => { await patchTryOnTake(projectId, userId, takeId, { refKind: "grok", refId: rid }).catch(() => {}); },
        onStatus: () => {
          const elapsed = Date.now() - started;
          const est = 22 + Math.round((1 - Math.exp(-elapsed / (2.5 * 60 * 1000))) * 74);
          void patchTryOnTake(projectId, userId, takeId, { status: "rendering", progress: Math.min(96, Math.max(8, est)), renderHeartbeatAt: Date.now() }).catch(() => {});
        },
      }),
      TAKE_TIMEOUT_MS,
      "This try-on took too long and timed out.",
    );
    const url = await uploadToS3(`try-on/${projectId}/${takeId}-${uid()}.mp4`, result.videoBuffer, "video/mp4");
    await patchTryOnTake(projectId, userId, takeId, { status: "ready", progress: 100, videoUrl: url, thumbnailUrl: url, error: null });
  } catch (e) {
    if (cost > 0) {
      await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: cost, referenceType: "tryon_take", referenceId: takeId, description: "Refund: try-on failed" }).catch(() => {});
    }
    console.error("[try-on] take render failed:", e instanceof Error ? e.message : e);
    await patchTryOnTake(projectId, userId, takeId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  } finally {
    void drainTryOnTakes(projectId, userId).catch(() => {});
  }
}

async function startTryOnTake(projectId: string, userId: string, takeId: string): Promise<{ ok: boolean; message?: string }> {
  const project = await getTryOnProject(projectId, userId);
  if (!project) return { ok: false, message: "Project not found." };
  const take = project.takes.find((t) => t.id === takeId);
  if (!take) return { ok: false, message: "Take not found." };
  if (take.status === "rendering") return { ok: true };
  if (!project.personImageUrl || !project.outfitImageUrl) {
    const msg = "Add both a person photo and an outfit photo first.";
    await patchTryOnTake(projectId, userId, takeId, { status: "failed", error: msg });
    return { ok: false, message: msg };
  }

  const cost = await getDynamicCreditCost(TRYON_COST_KEY).catch(() => 0);
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) { await patchTryOnTake(projectId, userId, takeId, { status: "failed", error: block.message }); return { ok: false, message: block.message }; }
  if (cost > 0) {
    const charge = await creditService.deductCredits({
      userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
      referenceType: "tryon_take", referenceId: takeId, description: "Virtual Try-on — take",
      metadata: { feature: TRYON_COST_KEY, projectId },
    });
    if (!charge.success) { await patchTryOnTake(projectId, userId, takeId, { status: "failed", error: charge.error || "Could not charge credits." }); return { ok: false, message: charge.error || "Could not charge credits." }; }
  }
  await patchTryOnTake(projectId, userId, takeId, { status: "rendering", progress: 6, error: null });
  void renderTryOnTake(projectId, userId, takeId, project);
  return { ok: true };
}

export async function drainTryOnTakes(projectId: string, userId: string, max = MAX_CONCURRENT_TRYON): Promise<number> {
  const project = await getTryOnProject(projectId, userId);
  if (!project) return 0;
  let active = project.takes.filter((t) => t.status === "rendering").length;
  const queued = project.takes.filter((t) => t.status === "queued").sort((a, b) => a.n - b.n);
  let started = 0;
  for (const t of queued) {
    if (active >= max) break;
    const res = await startTryOnTake(projectId, userId, t.id);
    if (res.ok) { active++; started++; }
    else if (/credit|insufficient|balance/i.test(res.message || "")) break;
  }
  return started;
}

export async function generateTryOnTakes(projectId: string, userId: string, count: number): Promise<{ ok: boolean; queued: number; started: number; message?: string; project?: TryOnProject }> {
  const project = await getTryOnProject(projectId, userId);
  if (!project) return { ok: false, queued: 0, started: 0, message: "Project not found." };
  if (!project.personImageUrl || !project.outfitImageUrl) {
    return { ok: false, queued: 0, started: 0, message: "Add both a person photo and an outfit photo first." };
  }
  const n = Math.max(1, Math.min(TRYON_MAX_TAKES, Math.round(count || 1)));
  const base = project.takes.length;
  for (let i = 0; i < n; i++) {
    const idx = base + i;
    project.takes.push(normalizeTryOnTake({ id: `take_${idx}_${uid()}`, n: idx + 1, x: 340 + (idx % 4) * 270, y: 110 + Math.floor(idx / 4) * 560, w: 236, status: "queued", progress: 0 }, idx));
  }
  await saveTryOnProject(projectId, userId, project);
  const started = await drainTryOnTakes(projectId, userId);
  const fresh = await getTryOnProject(projectId, userId);
  return { ok: true, queued: n, started, project: fresh ?? project };
}

export async function regenerateTryOnTake(projectId: string, userId: string, takeId: string): Promise<{ ok: boolean; project?: TryOnProject }> {
  await patchTryOnTake(projectId, userId, takeId, { status: "queued", progress: 0, error: null, videoUrl: null, refId: undefined, refKind: undefined });
  await drainTryOnTakes(projectId, userId);
  const project = await getTryOnProject(projectId, userId);
  return { ok: true, project: project ?? undefined };
}

// ── resume ────────────────────────────────────────────────────────────────────
async function resumeOrphanedTryOnTake(project: TryOnProject, t: TryOnTake, userId: string, now: number): Promise<boolean> {
  const lastBeat = t.renderHeartbeatAt || t.renderStartedAt || 0;
  if (now - lastBeat < TAKE_STALE_MS) return false;
  const startedAgo = t.renderStartedAt ? now - t.renderStartedAt : Infinity;
  const failRefund = async (msg: string) => {
    t.status = "failed"; t.error = msg;
    const refund = await getDynamicCreditCost(TRYON_COST_KEY).catch(() => 0);
    if (refund > 0) await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: refund, referenceType: "tryon_take", referenceId: t.id, description: "Refund: try-on interrupted" }).catch(() => {});
  };
  if (!t.refId || t.refKind !== "grok") {
    if (startedAgo > TAKE_NO_HANDLE_MS) { await failRefund("This try-on was interrupted — please try again."); return true; }
    return false;
  }
  try {
    const st = await grokVideoClient.pollOnce(t.refId);
    if (st.state === "failed") { await failRefund(`This try-on couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`); return true; }
    if (st.state === "done" && st.url) {
      const buf = await grokVideoClient.fetchVideoBuffer(st.url);
      const url = await uploadToS3(`try-on/${project.id}/${t.id}-${uid()}.mp4`, buf, "video/mp4");
      t.status = "ready"; t.progress = 100; t.videoUrl = url; t.thumbnailUrl = url; t.error = null;
      return true;
    }
    if (startedAgo > TAKE_RESUME_MAX_MS) { await failRefund("This try-on took too long — please try again."); return true; }
    t.renderHeartbeatAt = now - (TAKE_STALE_MS - TAKE_REPOLL_MS);
    return true;
  } catch (e) {
    console.error(`[try-on] resume failed for ${t.id}:`, e instanceof Error ? e.message : e);
    if (startedAgo > TAKE_RESUME_MAX_MS) { await failRefund("This try-on couldn't be recovered — please try again."); return true; }
    return false;
  }
}

export async function syncTryOnProject(project: TryOnProject, userId: string): Promise<TryOnProject> {
  const now = Date.now();
  let changed = false;
  for (const t of project.takes) {
    if (t.status === "rendering" && await resumeOrphanedTryOnTake(project, t, userId, now)) changed = true;
  }
  if (changed) await saveTryOnProject(project.id, userId, project);
  if (project.takes.some((t) => t.status === "queued")) void drainTryOnTakes(project.id, userId).catch(() => {});
  return project;
}

/** Cron entry (recover-tasks) — keep try-on batches flowing with no browser open. */
export async function resumeStuckTryOnTakes(): Promise<{ scanned: number; changed: number }> {
  const now = Date.now();
  const cutoff = new Date(now - TAKE_STALE_MS);
  let changed = 0;
  const rows = await prisma.design.findMany({
    where: { type: "tryon_project", updatedAt: { lt: cutoff } },
    select: { id: true, userId: true, canvasData: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  }).catch(() => [] as { id: string; userId: string; canvasData: string | null }[]);
  for (const row of rows) {
    if (!row.canvasData || (!row.canvasData.includes('"rendering"') && !row.canvasData.includes('"queued"'))) continue;
    const project = await getTryOnProject(row.id, row.userId).catch(() => null);
    if (!project) continue;
    let touched = false;
    for (const t of project.takes) {
      if (t.status === "rendering" && await resumeOrphanedTryOnTake(project, t, row.userId, now)) touched = true;
    }
    if (touched) { await saveTryOnProject(row.id, row.userId, project).catch(() => {}); changed++; }
    if (project.takes.some((t) => t.status === "queued")) { await drainTryOnTakes(row.id, row.userId).catch(() => {}); changed++; }
  }
  return { scanned: rows.length, changed };
}
