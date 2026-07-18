/**
 * Product Ads render engine — turn a product HERO STILL into a cinematic, timed
 * TVC-style ad with grok-imagine-video-1.5 IMAGE-to-video (the same model verified for
 * UGC). Same proven shape as the UGC/Director engines: bounded batch queue + drainer,
 * AWAITED provider-handle persist so a restart RESUMES, charge up-front + refund on fail.
 */
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { prisma } from "@/lib/db/client";
import { getAdProject, saveAdProject, patchAdTake } from "./store";
import { clampAdDuration, normalizeAdTake, AD_MAX_TAKES, type AdProject, type AdTake } from "./types";

const AD_COST_KEY = "AI_VIDEO_LITE";
const AD_MODEL = "grok-imagine-video-1.5";   // image-to-video
const MAX_CONCURRENT_ADS = 4;
const TAKE_TIMEOUT_MS = 12 * 60 * 1000;
const TAKE_STALE_MS = 60_000;
const TAKE_REPOLL_MS = 20_000;
const TAKE_RESUME_MAX_MS = 25 * 60 * 1000;
const TAKE_NO_HANDLE_MS = 3 * 60 * 1000;

function uid(): string { return Math.random().toString(36).slice(2, 9); }
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

/** The ad direction: hold the product EXACTLY as shot, then a timed camera sequence. */
function adPrompt(project: AdProject): string {
  const secs = clampAdDuration(project.durationSec);
  const mood = project.mood || "Luxury";
  const body = (project.prompt || "").trim();
  return (
    `PHOTOREAL cinematic ${mood.toUpperCase()} product advertisement built from the reference image — a real product filmed on a cinema camera; NOT 3D, NOT CGI, NOT animation. ` +
    `Shot on an Arri Alexa with anamorphic lenses: soft cinematic lighting, shallow depth of field, rich colour grading, photorealistic materials with correct reflections and refractions. ` +
    `High production value, slow and smooth camera movement, ${secs} seconds, 24fps.\n` +
    `PRODUCT LOCK — the product is EXACTLY the one in the reference image: keep its shape, colour, materials, proportions and label/branding identical. Do NOT redesign it, do NOT change or invent any text on it, do NOT swap it for a different product.\n` +
    (body ? `AD DIRECTION — ${body}\n` : "") +
    `Clean footage: absolutely NO on-screen text, captions, subtitles, title cards, price tags, watermarks or logos added anywhere; no readable gibberish text; no AI-tool badge. No people unless the direction asks for them. No distorted or warping geometry.`
  );
}

async function renderAdTake(projectId: string, userId: string, takeId: string, project: AdProject): Promise<void> {
  const cost = await getDynamicCreditCost(AD_COST_KEY).catch(() => 0);
  try {
    await patchAdTake(projectId, userId, takeId, { status: "rendering", progress: 8, renderStartedAt: Date.now(), renderHeartbeatAt: Date.now() });
    const started = Date.now();
    const result = await withTimeout(
      grokVideoClient.generateVideo(adPrompt(project), {
        model: AD_MODEL,
        duration: clampAdDuration(project.durationSec),
        aspectRatio: project.aspect,
        resolution: "720p",
        imageUrl: project.productImageUrl || undefined,
        timeoutMs: TAKE_TIMEOUT_MS,
        onJobId: async (rid) => { await patchAdTake(projectId, userId, takeId, { refKind: "grok", refId: rid }).catch(() => {}); },
        onStatus: () => {
          const elapsed = Date.now() - started;
          const est = 22 + Math.round((1 - Math.exp(-elapsed / (2.5 * 60 * 1000))) * 74);
          void patchAdTake(projectId, userId, takeId, { status: "rendering", progress: Math.min(96, Math.max(8, est)), renderHeartbeatAt: Date.now() }).catch(() => {});
        },
      }),
      TAKE_TIMEOUT_MS,
      "This ad took too long and timed out.",
    );
    const url = await uploadToS3(`product-ads/${projectId}/${takeId}-${uid()}.mp4`, result.videoBuffer, "video/mp4");
    await patchAdTake(projectId, userId, takeId, { status: "ready", progress: 100, videoUrl: url, thumbnailUrl: url, error: null });
  } catch (e) {
    if (cost > 0) {
      await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: cost, referenceType: "product_ad_take", referenceId: takeId, description: "Refund: product ad failed" }).catch(() => {});
    }
    console.error("[product-ads] take render failed:", e instanceof Error ? e.message : e);
    await patchAdTake(projectId, userId, takeId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  } finally {
    void drainAdTakes(projectId, userId).catch(() => {});
  }
}

async function startAdTake(projectId: string, userId: string, takeId: string): Promise<{ ok: boolean; message?: string }> {
  const project = await getAdProject(projectId, userId);
  if (!project) return { ok: false, message: "Project not found." };
  const take = project.takes.find((t) => t.id === takeId);
  if (!take) return { ok: false, message: "Take not found." };
  if (take.status === "rendering") return { ok: true };
  if (!project.productImageUrl) { await patchAdTake(projectId, userId, takeId, { status: "failed", error: "Add a product photo to the brief first." }); return { ok: false, message: "Add a product photo first." }; }

  const cost = await getDynamicCreditCost(AD_COST_KEY).catch(() => 0);
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) { await patchAdTake(projectId, userId, takeId, { status: "failed", error: block.message }); return { ok: false, message: block.message }; }
  if (cost > 0) {
    const charge = await creditService.deductCredits({
      userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
      referenceType: "product_ad_take", referenceId: takeId, description: "Product Ads — take",
      metadata: { feature: AD_COST_KEY, projectId },
    });
    if (!charge.success) { await patchAdTake(projectId, userId, takeId, { status: "failed", error: charge.error || "Could not charge credits." }); return { ok: false, message: charge.error || "Could not charge credits." }; }
  }
  await patchAdTake(projectId, userId, takeId, { status: "rendering", progress: 6, error: null });
  void renderAdTake(projectId, userId, takeId, project);
  return { ok: true };
}

export async function drainAdTakes(projectId: string, userId: string, max = MAX_CONCURRENT_ADS): Promise<number> {
  const project = await getAdProject(projectId, userId);
  if (!project) return 0;
  let active = project.takes.filter((t) => t.status === "rendering").length;
  const queued = project.takes.filter((t) => t.status === "queued").sort((a, b) => a.n - b.n);
  let started = 0;
  for (const t of queued) {
    if (active >= max) break;
    const res = await startAdTake(projectId, userId, t.id);
    if (res.ok) { active++; started++; }
    else if (/credit|insufficient|balance/i.test(res.message || "")) break;
  }
  return started;
}

export async function generateAdTakes(projectId: string, userId: string, count: number): Promise<{ ok: boolean; queued: number; started: number; message?: string; project?: AdProject }> {
  const project = await getAdProject(projectId, userId);
  if (!project) return { ok: false, queued: 0, started: 0, message: "Project not found." };
  if (!project.productImageUrl) return { ok: false, queued: 0, started: 0, message: "Add a product photo to the brief first." };
  const n = Math.max(1, Math.min(AD_MAX_TAKES, Math.round(count || 1)));
  const base = project.takes.length;
  for (let i = 0; i < n; i++) {
    const idx = base + i;
    project.takes.push(normalizeAdTake({ id: `take_${idx}_${uid()}`, n: idx + 1, x: 340 + (idx % 4) * 270, y: 110 + Math.floor(idx / 4) * 560, w: 236, status: "queued", progress: 0 }, idx));
  }
  await saveAdProject(projectId, userId, project);
  const started = await drainAdTakes(projectId, userId);
  const fresh = await getAdProject(projectId, userId);
  return { ok: true, queued: n, started, project: fresh ?? project };
}

export async function regenerateAdTake(projectId: string, userId: string, takeId: string): Promise<{ ok: boolean; project?: AdProject }> {
  await patchAdTake(projectId, userId, takeId, { status: "queued", progress: 0, error: null, videoUrl: null, refId: undefined, refKind: undefined });
  await drainAdTakes(projectId, userId);
  const project = await getAdProject(projectId, userId);
  return { ok: true, project: project ?? undefined };
}

// ── resume ────────────────────────────────────────────────────────────────────
async function resumeOrphanedAdTake(project: AdProject, t: AdTake, userId: string, now: number): Promise<boolean> {
  const lastBeat = t.renderHeartbeatAt || t.renderStartedAt || 0;
  if (now - lastBeat < TAKE_STALE_MS) return false;
  const startedAgo = t.renderStartedAt ? now - t.renderStartedAt : Infinity;
  const failRefund = async (msg: string) => {
    t.status = "failed"; t.error = msg;
    const refund = await getDynamicCreditCost(AD_COST_KEY).catch(() => 0);
    if (refund > 0) await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: refund, referenceType: "product_ad_take", referenceId: t.id, description: "Refund: product ad interrupted" }).catch(() => {});
  };
  if (!t.refId || t.refKind !== "grok") {
    if (startedAgo > TAKE_NO_HANDLE_MS) { await failRefund("This ad was interrupted — please try again."); return true; }
    return false;
  }
  try {
    const st = await grokVideoClient.pollOnce(t.refId);
    if (st.state === "failed") { await failRefund(`This ad couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`); return true; }
    if (st.state === "done" && st.url) {
      const buf = await grokVideoClient.fetchVideoBuffer(st.url);
      const url = await uploadToS3(`product-ads/${project.id}/${t.id}-${uid()}.mp4`, buf, "video/mp4");
      t.status = "ready"; t.progress = 100; t.videoUrl = url; t.thumbnailUrl = url; t.error = null;
      return true;
    }
    if (startedAgo > TAKE_RESUME_MAX_MS) { await failRefund("This ad took too long — please try again."); return true; }
    t.renderHeartbeatAt = now - (TAKE_STALE_MS - TAKE_REPOLL_MS);
    return true;
  } catch (e) {
    console.error(`[product-ads] resume failed for ${t.id}:`, e instanceof Error ? e.message : e);
    if (startedAgo > TAKE_RESUME_MAX_MS) { await failRefund("This ad couldn't be recovered — please try again."); return true; }
    return false;
  }
}

export async function syncAdProject(project: AdProject, userId: string): Promise<AdProject> {
  const now = Date.now();
  let changed = false;
  for (const t of project.takes) {
    if (t.status === "rendering" && await resumeOrphanedAdTake(project, t, userId, now)) changed = true;
  }
  if (changed) await saveAdProject(project.id, userId, project);
  if (project.takes.some((t) => t.status === "queued")) void drainAdTakes(project.id, userId).catch(() => {});
  return project;
}

/** Cron entry (recover-tasks) — keep ad batches flowing with no browser open. */
export async function resumeStuckAdTakes(): Promise<{ scanned: number; changed: number }> {
  const now = Date.now();
  const cutoff = new Date(now - TAKE_STALE_MS);
  let changed = 0;
  const rows = await prisma.design.findMany({
    where: { type: "product_ad_project", updatedAt: { lt: cutoff } },
    select: { id: true, userId: true, canvasData: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  }).catch(() => [] as { id: string; userId: string; canvasData: string | null }[]);
  for (const row of rows) {
    if (!row.canvasData || (!row.canvasData.includes('"rendering"') && !row.canvasData.includes('"queued"'))) continue;
    const project = await getAdProject(row.id, row.userId).catch(() => null);
    if (!project) continue;
    let touched = false;
    for (const t of project.takes) {
      if (t.status === "rendering" && await resumeOrphanedAdTake(project, t, row.userId, now)) touched = true;
    }
    if (touched) { await saveAdProject(row.id, row.userId, project).catch(() => {}); changed++; }
    if (project.takes.some((t) => t.status === "queued")) { await drainAdTakes(row.id, row.userId).catch(() => {}); changed++; }
  }
  return { scanned: rows.length, changed };
}
