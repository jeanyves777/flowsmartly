/**
 * Clone Yourself — ENGINES.
 *
 * Everything is identity-preserving image-to-image off the uploaded reference
 * photos (+ an optional generated anchor). A shot puts YOU in a scene/outfit/pose;
 * a background-only shot is the same scene with no person. An actor clone can be
 * handed off to the UGC or Film studios to make videos of you.
 *
 * Fire-and-forget renders with a heartbeat, so a deploy/crash can't strand a shot —
 * an image render holds no provider job, so a dead one is simply re-run. [[clone-studio]]
 */
import { getProject, saveProject, patchShot, patchClone } from "./store";
import { cloneDims, type CloneProject, type CloneShot, type CloneIdentity, type CloneQuality } from "./types";
import { generateImageXaiFirst, editImagesXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable, type CreditCostKey } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { createUgcProject } from "@/lib/ugc-studio/store";
import { createFilm, saveFilm } from "@/lib/video-director/store";
import { normalizeCharacter } from "@/lib/video-director/types";

const STD_COST: CreditCostKey = "AI_VISUAL_DESIGN";
const PREMIUM_COST: CreditCostKey = "AGENT_GENERATE_IMAGE_PREMIUM";
const MAX_CONCURRENT = 3;
const SHOT_STALE_MS = 90_000;
const SHOT_MAX_TRIES = 3;

const costKey = (q: CloneQuality): CreditCostKey => (q === "premium" ? PREMIUM_COST : STD_COST);
const imgQuality = (q: CloneQuality) => (q === "premium" ? ("high" as const) : ("high" as const));
const imgProvider = (q: CloneQuality) => (q === "premium" ? ("openai" as const) : null);

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
async function toBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

async function charge(userId: string, key: CreditCostKey, ref: string, description: string, meta: Record<string, unknown>): Promise<string | null> {
  const cost = await getDynamicCreditCost(key).catch(() => 0);
  if (cost <= 0) return null;
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) return block.message;
  const res = await creditService.deductCredits({
    userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
    referenceType: "clone", referenceId: ref, description, metadata: { feature: key, ...meta },
  });
  return res.success ? null : (res.error || "Could not charge credits.");
}
async function refund(userId: string, key: CreditCostKey, ref: string, why: string): Promise<void> {
  const amount = await getDynamicCreditCost(key).catch(() => 0);
  if (amount <= 0) return;
  await creditService.addCredits({
    userId, type: TRANSACTION_TYPES.REFUND, amount,
    referenceType: "clone", referenceId: `${ref}:refund`, description: `Refund — ${why}`,
  }).catch(() => {});
}

// The reference photos (+ anchor) that lock a clone's identity.
function refUrlsFor(p: CloneProject, cloneId: string | null): string[] {
  if (!cloneId) return [];
  const c = p.clones.find((x) => x.id === cloneId);
  if (!c) return [];
  return [c.anchorUrl, ...c.photoUrls].filter(isUrl).slice(0, 4);
}

const IDENTITY_RULES =
  "IDENTITY (critical)\n" +
  "- The reference image(s) are the SAME real person. Reproduce them EXACTLY — identical face, facial structure, skin tone, hair, age and build. This is a photo of THAT person, not a lookalike.\n" +
  "- PHOTOREAL only: a real photograph, natural skin texture and lighting. Not a 3D render, illustration or cartoon.\n" +
  "- Frame them naturally in the scene; hands and body look real and correct.";

function buildShotPrompt(shot: CloneShot): string {
  if (shot.kind === "background") {
    return `${shot.prompt}\n\nHARD RULES\n- Absolutely NO person in the frame. An empty scene / background plate only — clean, usable behind a real webcam.`;
  }
  const bits = [shot.prompt.trim()];
  if (shot.outfit && shot.outfit !== "Keep current") bits.push(`Wearing: ${shot.outfit}.`);
  if (shot.pose) bits.push(`Pose / framing: ${shot.pose}.`);
  return `${bits.filter(Boolean).join(" ")}\n\n${IDENTITY_RULES}`;
}

// ─────────────────────────────── anchor (clean hero look)

/** Build a clean, front-facing hero portrait from the uploaded photos — the stable
 *  reference reused for every shot and for the UGC/Film handoff. */
export async function buildCloneAnchor(id: string, userId: string, cloneId: string): Promise<CloneProject | null> {
  const p = await getProject(id, userId);
  if (!p) return null;
  const c = p.clones.find((x) => x.id === cloneId);
  if (!c || c.photoUrls.length === 0) return p;
  try {
    const refs = await Promise.all(c.photoUrls.slice(0, 4).map(toBuffer));
    const res = await editImagesXaiFirst(
      `A clean, well-lit hero PORTRAIT of the SAME person in the reference image(s): head-and-shoulders to three-quarter, front/three-quarter angle, neutral confident expression, plain soft studio backdrop.\n\n${IDENTITY_RULES}`,
      refs, 1024, 1280, { intent: "identity", quality: "high" },
    );
    if (res.base64) {
      const url = await uploadToS3(`clone/${id}/anchor-${cloneId}-${uid()}.${res.format === "jpeg" ? "jpg" : res.format}`, Buffer.from(res.base64, "base64"), res.format === "jpeg" ? "image/jpeg" : `image/${res.format}`);
      await patchClone(id, userId, cloneId, { anchorUrl: url });
    }
  } catch (err) {
    console.error("[clone-studio] anchor failed:", err);
  }
  return getProject(id, userId);
}

// ─────────────────────────────── shots

export async function renderShot(id: string, userId: string, shotId: string): Promise<void> {
  const p = await getProject(id, userId);
  if (!p) return;
  const shot = p.shots.find((s) => s.id === shotId);
  if (!shot) return;

  const { w, h } = cloneDims(shot.aspect);
  const key = costKey(shot.quality);
  await patchShot(id, userId, shotId, { status: "rendering", progress: 8, error: null, renderHeartbeatAt: Date.now() });

  const err = await charge(userId, key, `${id}:${shotId}:${uid()}`, "Clone Studio — image", { cloneId: id, shotId, quality: shot.quality });
  if (err) { await patchShot(id, userId, shotId, { status: "failed", error: err }); return; }

  try {
    const prompt = buildShotPrompt(shot);
    const refs = shot.kind === "person" ? refUrlsFor(p, shot.cloneId) : [];
    const res = refs.length
      ? await editImagesXaiFirst(prompt, await Promise.all(refs.map(toBuffer)), w, h, { intent: "identity", quality: imgQuality(shot.quality), preferredProvider: imgProvider(shot.quality) })
      : await generateImageXaiFirst(prompt, w, h, { quality: imgQuality(shot.quality), transparent: false, preferredProvider: imgProvider(shot.quality) });
    if (!res.base64) throw new Error("no image returned");
    const url = await uploadToS3(
      `clone/${id}/shot-${shotId}-${uid()}.${res.format === "jpeg" ? "jpg" : res.format}`,
      Buffer.from(res.base64, "base64"),
      res.format === "jpeg" ? "image/jpeg" : `image/${res.format}`,
    );
    await patchShot(id, userId, shotId, { imageUrl: url, status: "ready", progress: 100, renderHeartbeatAt: Date.now() });
  } catch (e) {
    await refund(userId, key, `${id}:${shotId}`, "clone image failed");
    console.error(`[clone-studio] shot ${shotId} failed:`, e);
    await patchShot(id, userId, shotId, { status: "failed", error: sanitizeUserError(e, "image") });
  } finally {
    void drainShots(id, userId).catch(() => {});
  }
}

export async function drainShots(id: string, userId: string, max = MAX_CONCURRENT): Promise<number> {
  const p = await getProject(id, userId);
  if (!p) return 0;
  const live = p.shots.filter((s) => s.status === "rendering").length;
  const free = Math.max(0, max - live);
  if (free === 0) return 0;
  const next = p.shots.filter((s) => s.status === "queued").slice(0, free);
  for (const s of next) {
    await patchShot(id, userId, s.id, { status: "rendering", progress: 4, renderHeartbeatAt: Date.now() }).catch(() => {});
    void renderShot(id, userId, s.id).catch(() => {});
  }
  return next.length;
}

export async function generateAllShots(id: string, userId: string): Promise<{ ok: boolean; queued: number; message?: string }> {
  const p = await getProject(id, userId);
  if (!p) return { ok: false, queued: 0, message: "Not found" };
  const pending = p.shots.filter((s) => s.status !== "ready" && s.status !== "rendering");
  if (pending.length === 0) return { ok: true, queued: 0, message: "Every shot is done." };
  for (const s of pending) {
    const i = p.shots.findIndex((x) => x.id === s.id);
    p.shots[i] = { ...p.shots[i], status: "queued", progress: 0, error: null };
  }
  await saveProject(id, userId, p);
  await drainShots(id, userId);
  return { ok: true, queued: pending.length };
}

// ─────────────────────────────── actor handoff (use in UGC / Film)

/** A clone's best available identity image for a video handoff. */
function handoffImage(c: CloneIdentity): string | null {
  return isUrl(c.anchorUrl) ? c.anchorUrl : (c.photoUrls.find(isUrl) ?? null);
}

/** Send a clone into the UGC studio as the on-camera creator. Returns the new project + deep link. */
export async function useCloneInUgc(id: string, userId: string, cloneId: string): Promise<{ ok: boolean; deepLink?: string; message?: string }> {
  const p = await getProject(id, userId);
  if (!p) return { ok: false, message: "Not found" };
  const c = p.clones.find((x) => x.id === cloneId);
  const photo = c && handoffImage(c);
  if (!photo) return { ok: false, message: "Build the clone's look first." };
  const ugc = await createUgcProject(userId, { title: `${c!.name} — UGC`, photoUrl: photo });
  return { ok: true, deepLink: `/home/ugc?project=${ugc.id}` };
}

/** Add a clone to a new film as a ready cast member. Returns the film + deep link. */
export async function useCloneInFilm(id: string, userId: string, cloneId: string): Promise<{ ok: boolean; deepLink?: string; message?: string }> {
  const p = await getProject(id, userId);
  if (!p) return { ok: false, message: "Not found" };
  const c = p.clones.find((x) => x.id === cloneId);
  const photo = c && handoffImage(c);
  if (!c || !photo) return { ok: false, message: "Build the clone's look first." };

  const film = await createFilm(userId, { title: `${c.name} — film`, filmType: "ai_film" });
  // Seed the clone as an APPROVED cast member so the film reuses its identity directly —
  // the anchor image is the reference every AI shot is generated against.
  const character = normalizeCharacter({
    name: c.name, role: "You", description: `${c.name} — the user's own cloned likeness.`,
    renderStyle: "cinematic", referenceImageUrl: photo, characterSheetUrl: photo,
    previewStatus: "ready", approved: true,
  }, 0);
  film.characters = [character];
  await saveFilm(film.id, userId, film).catch(() => {});
  return { ok: true, deepLink: `/home/director?film=${film.id}` };
}

// ─────────────────────────────── recovery

/** Re-run image shots orphaned by a restart (no provider job to pull). Bounded. */
export async function syncCloneProject(p: CloneProject, userId: string): Promise<CloneProject> {
  const now = Date.now();
  let changed = false;
  for (const s of p.shots) {
    if (s.status !== "rendering") continue;
    if (now - (s.renderHeartbeatAt || 0) < SHOT_STALE_MS) continue;
    if ((s.tries || 0) >= SHOT_MAX_TRIES) { s.status = "failed"; s.error = "That render didn't finish. Try again."; changed = true; continue; }
    s.tries = (s.tries || 0) + 1; s.status = "queued"; s.progress = 0; changed = true;
  }
  if (changed) await saveProject(p.id, userId, p).catch(() => {});
  if (p.shots.some((s) => s.status === "queued")) void drainShots(p.id, userId).catch(() => {});
  return p;
}

export async function resumeStuckCloneShots(): Promise<{ scanned: number; changed: number }> {
  const now = Date.now();
  let changed = 0;
  const rows = await prisma.design
    .findMany({ where: { type: "clone_project", updatedAt: { lt: new Date(now - SHOT_STALE_MS) } }, select: { id: true, userId: true, canvasData: true }, orderBy: { updatedAt: "desc" }, take: 40 })
    .catch(() => [] as { id: string; userId: string; canvasData: string | null }[]);
  for (const row of rows) {
    if (!row.canvasData || (!row.canvasData.includes('"rendering"') && !row.canvasData.includes('"queued"'))) continue;
    const p = await getProject(row.id, row.userId).catch(() => null);
    if (!p) continue;
    await syncCloneProject(p, row.userId).catch(() => {});
    changed++;
  }
  if (changed) console.log(`[clone-studio] resumeStuckCloneShots: touched ${changed}`);
  return { scanned: rows.length, changed };
}
