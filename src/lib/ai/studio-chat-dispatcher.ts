import { prisma } from "@/lib/db/client";
import type { DispatchEnvelope } from "@/lib/ai/studio-chat-agent";

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

  // Route both modes to /api/ai/visual for now — /api/ai/design-layout
  // returns a layout JSON spec (no imageUrl), so smart_layout from chat
  // always failed with "Worker returned no image URL". Until we wire a
  // server-side fabric renderer to convert the layout spec to a Design
  // row + thumbnail, "editable" mode generates the visual via the same
  // worker and the user opens it in the editor to tweak text overlays.
  // The mode flag still flows to the worker so we can branch on it
  // later without changing the chat contract.
  const route = "/api/ai/visual";
  const body: Record<string, unknown> = {
    prompt,
    category: category ?? "social_post",
    size: `${width}x${height}`,
    style: style ?? "polished",
    ctaText: ctaText ?? null,
    provider: "openai",
    referenceImageUrl: referenceImageUrl ?? null,
    chatOutputMode: mode, // forwarded so the worker can later branch
  };

  // BrandKit lookup — both endpoints accept brandColors directly.
  if (useBrandColors) {
    // We don't have userId here, so we let the worker route fetch it
    // from the session via cookie. The worker handles the BrandKit lookup.
    body.brandColors = "auto";  // sentinel; worker resolves to user's kit
  }

  const res = await fetch(`${opts.origin}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookieHeader ? { cookie: opts.cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    env.status = "failed";
    env.error = data?.error?.message || `worker ${route} returned ${res.status}`;
    return;
  }

  // /api/ai/visual returns { success, data: { design: { id, imageUrl, ... } } }
  // /api/ai/design-layout returns a layout spec — for Phase 1.5 we treat
  // smart_layout's "result" as the design row it creates.
  const designId: string | undefined =
    data?.data?.design?.id || data?.data?.designId || data?.designId;
  const imageUrl: string | undefined =
    data?.data?.design?.imageUrl || data?.data?.imageUrl || data?.imageUrl;

  if (designId) {
    // Attach chatId + branchId to the Design row so the chat history
    // stays linked.
    try {
      await prisma.design.update({
        where: { id: designId },
        data: { chatId: opts.chatId, branchId },
      });
    } catch (err) {
      console.warn("[ChatDispatcher] failed to attach chatId to design (non-fatal):", err);
    }
  }

  env.status = imageUrl ? "complete" : "failed";
  env.designId = designId;
  env.imageUrl = imageUrl;
  env.width = width;
  env.height = height;
  if (!imageUrl) env.error = "Worker returned no image URL";
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
