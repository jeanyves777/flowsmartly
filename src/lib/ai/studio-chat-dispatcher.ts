import { prisma } from "@/lib/db/client";
import type { DispatchEnvelope } from "@/lib/ai/studio-chat-agent";
import { reproduceTemplate } from "@/lib/ai/template-reproduce-agent";

/**
 * Studio Chat Dispatcher — fires worker endpoints after the agent loop.
 *
 * Why this layer exists:
 *  - The agent module (studio-chat-agent.ts) stays pure — it builds
 *    DispatchEnvelopes but doesn't make HTTP calls. That keeps the
 *    Claude tool loop fast and side-effect-free.
 *  - This dispatcher layer reads each envelope, calls the appropriate
 *    worker (`/api/ai/visual` for ai_image, `/api/ai/design-layout`
 *    for smart_layout, `/api/ai/video-studio/generate` for video,
 *    `/api/studio/templates/remix` for remix), then attaches the
 *    result back to the envelope before the route returns it to the
 *    frontend.
 *  - Auth: workers expect a session cookie. We forward the user's
 *    incoming cookie header on every internal fetch. Server-to-server
 *    runs in the same process so cookies pass straight through.
 *
 * Phase 1.5 scope: synchronous dispatch — agent loop returns, then
 * dispatcher fires workers in parallel and returns enriched envelopes.
 * Total round-trip = agent latency + slowest worker latency. SSE
 * streaming for live updates lands in Phase 2.
 */

interface DispatchOpts {
  /** Each request's incoming cookie header — forwarded to the worker so
   *  the worker sees the same authenticated user as the chat caller. */
  cookieHeader: string | null;
  /** Used to attach `chatId` / `branchId` to any Design row the worker
   *  creates. Workers don't know about chats — we patch the row after
   *  they return. */
  chatId: string;
  /** Origin for internal fetches, e.g. "http://localhost:3000". */
  origin: string;
}

/**
 * Process all dispatched envelopes in parallel. Mutates each envelope
 * in place — caller doesn't need to read the return value, but it's
 * provided for convenience.
 */
export async function dispatchAll(
  envelopes: DispatchEnvelope[],
  opts: DispatchOpts,
): Promise<DispatchEnvelope[]> {
  if (envelopes.length === 0) return envelopes;
  await Promise.all(envelopes.map((env) => dispatchOne(env, opts)));
  return envelopes;
}

async function dispatchOne(env: DispatchEnvelope, opts: DispatchOpts): Promise<void> {
  try {
    if (env.kind === "design") {
      await dispatchDesign(env, opts);
    } else if (env.kind === "video") {
      await dispatchVideo(env, opts);
    } else if (env.kind === "remix") {
      await dispatchRemix(env, opts);
    }
  } catch (err) {
    env.status = "failed";
    env.error = err instanceof Error ? err.message : String(err);
    console.error(`[ChatDispatcher] ${env.kind} failed:`, err);
  }
}

// ─── design (image) ───────────────────────────────────────────────────
async function dispatchDesign(
  env: Extract<DispatchEnvelope, { kind: "design" }>,
  opts: DispatchOpts,
): Promise<void> {
  const { mode, prompt, width, height, category, style, ctaText, referenceImageUrl, useBrandColors, branchId } = env.args;

  // ─── ENGINE ROUTING ──────────────────────────────────────────────────
  //
  // FLAT (mode === "ai_image"):
  //   Send everything (prompt + reference photo) to /api/ai/visual,
  //   which calls gpt-image-1.edit when a reference is present. The
  //   model itself bakes the subject into the design — we don't run
  //   any sharp.composite on top.
  //
  // EDITABLE (mode === "smart_layout"):
  //   Two-step Claude composite engine:
  //   Step 1 — generate a polished source image via /api/ai/visual.
  //   Step 2 — feed that image into reproduceTemplate() (Claude vision)
  //   which returns a Fabric canvas spec with EVERY text/shape/photo
  //   slot as an editable layer. We save Design.canvasData with the
  //   spec so the Studio editor opens it with editable layers, and
  //   keep the polished image as the imageUrl/thumbnail. The result
  //   card in chat shows the image; clicking opens the editable canvas.
  //
  // Both engines need the visual call. We always run that first.
  // ────────────────────────────────────────────────────────────────────

  const visualBody: Record<string, unknown> = {
    prompt,
    category: category ?? "social_post",
    size: `${width}x${height}`,
    style: style ?? "polished",
    ctaText: ctaText ?? null,
    provider: "openai",
    referenceImageUrl: referenceImageUrl ?? null,
    chatOutputMode: mode,
  };
  if (useBrandColors) visualBody.brandColors = "auto";

  const visualRes = await fetch(`${opts.origin}/api/ai/visual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookieHeader ? { cookie: opts.cookieHeader } : {}),
    },
    body: JSON.stringify(visualBody),
  });
  const visualData = await visualRes.json().catch(() => ({}));
  if (!visualRes.ok) {
    env.status = "failed";
    env.error = visualData?.error?.message || `visual worker returned ${visualRes.status}`;
    return;
  }

  let designId: string | undefined =
    visualData?.data?.design?.id || visualData?.data?.designId || visualData?.designId;
  const imageUrl: string | undefined =
    visualData?.data?.design?.imageUrl || visualData?.data?.imageUrl || visualData?.imageUrl;

  if (!imageUrl) {
    env.status = "failed";
    env.error = "Visual worker returned no image URL";
    return;
  }

  // For FLAT mode we're done — attach chatId/branchId and exit.
  // For EDITABLE mode, run Claude composite to extract editable layers
  // and persist them on the same Design row.
  if (mode === "smart_layout") {
    try {
      console.log("[ChatDispatcher] running Claude composite (reproduceTemplate) for editable mode...");

      // Look up the user's BrandKit so the composite engine has brand
      // colors + fonts to enforce post-hoc on the editable spec.
      const chat = await prisma.designChat.findUnique({
        where: { id: opts.chatId },
        select: { userId: true },
      });
      let brandColors: { primary?: string; secondary?: string; accent?: string } | null = null;
      let brandFonts: { heading?: string; body?: string } | null = null;
      if (chat?.userId) {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: chat.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          select: { colors: true, fonts: true },
        });
        if (kit) {
          try {
            const c = JSON.parse(kit.colors || "{}");
            if (c && typeof c === "object") {
              brandColors = {
                primary: typeof c.primary === "string" ? c.primary : undefined,
                secondary: typeof c.secondary === "string" ? c.secondary : undefined,
                accent: typeof c.accent === "string" ? c.accent : undefined,
              };
            }
          } catch { /* ignore */ }
          try {
            const f = JSON.parse(kit.fonts || "{}");
            if (f && typeof f === "object") {
              brandFonts = {
                heading: typeof f.heading === "string" ? f.heading : undefined,
                body: typeof f.body === "string" ? f.body : undefined,
              };
            }
          } catch { /* ignore */ }
        }
      }

      const reproduce = await reproduceTemplate(imageUrl, {
        customText: prompt,
        brandColors,
        brandFonts,
      });
      const canvasData = JSON.stringify(reproduce.canvas);
      if (designId) {
        await prisma.design.update({
          where: { id: designId },
          data: { canvasData },
        });
      } else {
        // Visual route didn't create a Design row (rare path) — create
        // one ourselves so the user can open the editable result.
        const created = await prisma.design.create({
          data: {
            userId: (await prisma.designChat.findUnique({ where: { id: opts.chatId }, select: { userId: true } }))?.userId || "",
            prompt: String(prompt).slice(0, 4000),
            category: category ?? "social_post",
            size: `${width}x${height}`,
            style: style ?? "polished",
            imageUrl,
            canvasData,
            status: "COMPLETED",
          },
        });
        designId = created.id;
      }
      console.log(`[ChatDispatcher] editable layers saved on design ${designId} (${reproduce.canvas.objects.length} objects)`);
    } catch (err) {
      // Non-fatal: the user still has a valid flat image in the
      // chat — they just don't get the editable layers. Surface the
      // failure in logs so we can debug, but don't fail the dispatch.
      console.error("[ChatDispatcher] reproduceTemplate failed (continuing with flat result):", err);
    }
  }

  if (designId) {
    try {
      await prisma.design.update({
        where: { id: designId },
        data: { chatId: opts.chatId, branchId },
      });
    } catch (err) {
      console.warn("[ChatDispatcher] failed to attach chatId to design (non-fatal):", err);
    }
  }

  env.status = "complete";
  env.designId = designId;
  env.imageUrl = imageUrl;
  env.width = width;
  env.height = height;
}

// ─── video ────────────────────────────────────────────────────────────
async function dispatchVideo(
  env: Extract<DispatchEnvelope, { kind: "video" }>,
  opts: DispatchOpts,
): Promise<void> {
  const { prompt, aspectRatio, durationSeconds, voiceover, referenceImageUrl } = env.args;
  const res = await fetch(`${opts.origin}/api/ai/video-studio/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookieHeader ? { cookie: opts.cookieHeader } : {}),
    },
    body: JSON.stringify({
      prompt,
      aspectRatio: aspectRatio ?? "9:16",
      durationSeconds: durationSeconds ?? 5,
      voiceover: voiceover ?? false,
      referenceImageUrl: referenceImageUrl ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    env.status = "failed";
    env.error = data?.error?.message || `video worker returned ${res.status}`;
    return;
  }
  env.status = "complete";
  env.designId = data?.data?.designId || data?.designId;
  env.videoUrl = data?.data?.videoUrl || data?.videoUrl;
}

// ─── remix ────────────────────────────────────────────────────────────
async function dispatchRemix(
  env: Extract<DispatchEnvelope, { kind: "remix" }>,
  opts: DispatchOpts,
): Promise<void> {
  const { sourceImageUrl, customText, useBrandColors } = env.args;
  const res = await fetch(`${opts.origin}/api/studio/templates/remix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookieHeader ? { cookie: opts.cookieHeader } : {}),
    },
    body: JSON.stringify({
      imageUrl: sourceImageUrl,
      customText: customText ?? "",
      useBrandColors: useBrandColors === true,
      userPhotos: [],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    env.status = "failed";
    env.error = data?.error?.message || `remix worker returned ${res.status}`;
    return;
  }
  env.status = "complete";
  env.imageUrl = data?.remixedImageUrl;
  env.width = data?.width;
  env.height = data?.height;
}
