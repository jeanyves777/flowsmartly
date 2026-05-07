import { prisma } from "@/lib/db/client";
import type { DispatchEnvelope } from "@/lib/ai/studio-chat-agent";
import { reproduceTemplate } from "@/lib/ai/template-reproduce-agent";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { runFlatImageAgent } from "@/lib/ai/flat-image-agent";
import { runEditableDesignAgent } from "@/lib/ai/editable-design-agent";
import { processDesignThumbnail } from "@/lib/designs/thumbnail-processor";

/** Env flag — when "true", routes design dispatches through the SDK
 *  agent loops (flat-image-agent / editable-design-agent). When unset
 *  or "false", uses the existing /api/ai/visual + reproduceTemplate
 *  pipeline. Lets us roll out the new engines gradually + flip back
 *  fast if anything regresses. */
const USE_SDK_DESIGN_ENGINES = process.env.USE_SDK_DESIGN_ENGINES === "true";

/**
 * Run rembg on a remote/local image URL and return the cutout as a
 * data URL we can drop straight into a Fabric image element. Falls
 * back to the original URL when rembg isn't available (Windows dev)
 * or the call fails — better to show the user's photo with its
 * original background than a blank placeholder.
 */
async function cutoutAsDataUrl(imageUrl: string): Promise<string> {
  if (!isRembgAvailable()) return imageUrl;
  const tmpDir = path.join(os.tmpdir(), "fs-bg");
  try {
    await mkdir(tmpDir, { recursive: true });
    let buf: Buffer;
    if (imageUrl.startsWith("data:")) {
      const b64 = imageUrl.replace(/^data:image\/[^;]+;base64,/, "");
      buf = Buffer.from(b64, "base64");
    } else if (imageUrl.startsWith("http")) {
      const r = await fetch(imageUrl);
      if (!r.ok) return imageUrl;
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      buf = await readFile(path.join(process.cwd(), "public", imageUrl.replace(/^\//, "")));
    }
    const inPath = path.join(tmpDir, `${randomUUID()}.png`);
    const normalized = await sharp(buf).png().toBuffer();
    await writeFile(inPath, normalized);
    try {
      const result = await removeBackground(inPath, { model: "u2net" });
      const cutout = await readFile(result.outputPath);
      void unlink(inPath).catch(() => undefined);
      void unlink(result.outputPath).catch(() => undefined);
      return `data:image/png;base64,${cutout.toString("base64")}`;
    } finally {
      void unlink(inPath).catch(() => undefined);
    }
  } catch (err) {
    console.warn("[ChatDispatcher] cutout failed, using original ref:", err);
    return imageUrl;
  }
}

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

interface ChatBrandIdentity {
  raw: Record<string, unknown>;
  colors: { primary?: string; secondary?: string; accent?: string } | null;
  fonts: { heading?: string; body?: string } | null;
  logoUrl: string | null;
  handles: Record<string, string> | null;
  contactInfo: { email?: string | null; phone?: string | null; website?: string | null; address?: string | null } | null;
}

function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadChatBrandIdentity(chatId: string): Promise<ChatBrandIdentity | null> {
  const chat = await prisma.designChat.findUnique({
    where: { id: chatId },
    select: { userId: true },
  });
  if (!chat?.userId) return null;

  const kit = await prisma.brandKit.findFirst({
    where: { userId: chat.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      name: true,
      tagline: true,
      description: true,
      industry: true,
      niche: true,
      targetAudience: true,
      audienceAge: true,
      audienceLocation: true,
      voiceTone: true,
      personality: true,
      keywords: true,
      avoidWords: true,
      guidelines: true,
      hashtags: true,
      products: true,
      uniqueValue: true,
      colors: true,
      fonts: true,
      logo: true,
      iconLogo: true,
      email: true,
      phone: true,
      website: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      handles: true,
    },
  });
  if (!kit) return null;

  const colors = parseJsonObject<{ primary?: string; secondary?: string; accent?: string }>(kit.colors);
  const fonts = parseJsonObject<{ heading?: string; body?: string }>(kit.fonts);
  const handles = parseJsonObject<Record<string, unknown>>(kit.handles);
  const cleanHandles = handles
    ? Object.fromEntries(Object.entries(handles).filter(([, value]) => typeof value === "string" && value.trim()))
    : null;
  const fullAddress = [kit.address, kit.city, kit.state, kit.zip, kit.country].filter(Boolean).join(", ");
  const contactInfo = {
    email: kit.email,
    phone: kit.phone,
    website: kit.website,
    address: fullAddress || kit.address,
  };

  const raw = {
    name: kit.name,
    tagline: kit.tagline,
    description: kit.description,
    industry: kit.industry,
    niche: kit.niche,
    audience: {
      target: kit.targetAudience,
      age: kit.audienceAge,
      location: kit.audienceLocation,
    },
    voice: kit.voiceTone,
    personality: parseJsonArray(kit.personality),
    keywords: parseJsonArray(kit.keywords),
    avoidWords: parseJsonArray(kit.avoidWords),
    guidelines: kit.guidelines,
    hashtags: parseJsonArray(kit.hashtags),
    products: parseJsonArray(kit.products),
    uniqueValue: kit.uniqueValue,
    colors,
    fonts,
    logo: kit.logo || kit.iconLogo || null,
    handles: cleanHandles,
    contact: contactInfo,
  };

  return {
    raw,
    colors,
    fonts,
    logoUrl: kit.logo || kit.iconLogo || null,
    handles: cleanHandles as Record<string, string> | null,
    contactInfo,
  };
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
  if (USE_SDK_DESIGN_ENGINES) {
    return dispatchDesignViaSdk(env, opts);
  }
  return dispatchDesignViaLegacy(env, opts);
}

// ─── SDK engine path ──────────────────────────────────────────────────
// Routes design dispatches through the Claude Agent SDK engines:
// flat → runFlatImageAgent, editable → runEditableDesignAgent. Both
// agents use a tool-using loop with critique-and-iterate cycles, so
// the result is a real polished design rather than a one-shot.
async function dispatchDesignViaSdk(
  env: Extract<DispatchEnvelope, { kind: "design" }>,
  opts: DispatchOpts,
): Promise<void> {
  const { mode, prompt, width, height, category, referenceImageUrl, useBrandColors, branchId } = env.args;

  // Look up the user + brand kit so the agent has the full brief.
  const chat = await prisma.designChat.findUnique({
    where: { id: opts.chatId },
    select: { userId: true },
  });
  if (!chat?.userId) {
    env.status = "failed";
    env.error = "Chat not found or has no userId";
    return;
  }

  const kit = await prisma.brandKit.findFirst({
    where: { userId: chat.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      name: true, voiceTone: true, colors: true, fonts: true, logo: true,
    },
  });
  let brand: {
    name?: string;
    voiceTone?: string;
    primary?: string;
    secondary?: string;
    accent?: string;
    logoUrl?: string;
    fonts?: { heading?: string; body?: string };
  } | undefined;
  if (kit) {
    let primary: string | undefined;
    let secondary: string | undefined;
    let accent: string | undefined;
    try {
      const c = JSON.parse(kit.colors || "{}");
      primary = typeof c.primary === "string" ? c.primary : undefined;
      secondary = typeof c.secondary === "string" ? c.secondary : undefined;
      accent = typeof c.accent === "string" ? c.accent : undefined;
    } catch { /* ignore */ }
    let heading: string | undefined;
    let body: string | undefined;
    try {
      const f = JSON.parse(kit.fonts || "{}");
      heading = typeof f.heading === "string" ? f.heading : undefined;
      body = typeof f.body === "string" ? f.body : undefined;
    } catch { /* ignore */ }
    brand = {
      name: kit.name || undefined,
      voiceTone: kit.voiceTone || undefined,
      primary: useBrandColors ? primary : undefined,
      secondary: useBrandColors ? secondary : undefined,
      accent: useBrandColors ? accent : undefined,
      logoUrl: kit.logo || undefined,
      fonts: heading || body ? { heading, body } : undefined,
    };
  }

  const sharedBrief = {
    category: category ?? "social_post",
    topic: prompt,
    designText: prompt, // chat agent already concatenates literal copy into prompt
    width,
    height,
    brand,
    referenceImageUrl: referenceImageUrl ?? undefined,
  };

  let imageDataUrl: string;
  let finalWidth = width;
  let finalHeight = height;
  let canvasDataJson: string | null = null;
  let agentTelemetry: Record<string, unknown> = {};

  try {
    if (mode === "smart_layout") {
      const result = await runEditableDesignAgent(sharedBrief);
      imageDataUrl = result.imageDataUrl;
      finalWidth = result.width;
      finalHeight = result.height;
      canvasDataJson = JSON.stringify(result.canvas);
      agentTelemetry = {
        engine: "editable-design-agent",
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
        critiqueLog: result.critiqueLog,
        costUsd: result.totalCostUsd,
        layers: result.canvas.objects.length,
      };
    } else {
      const result = await runFlatImageAgent(sharedBrief);
      imageDataUrl = result.imageDataUrl;
      finalWidth = result.width;
      finalHeight = result.height;
      agentTelemetry = {
        engine: "flat-image-agent",
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
        critiqueLog: result.critiqueLog,
        costUsd: result.totalCostUsd,
      };
    }
    console.log("[ChatDispatcher/SDK] agent finished:", agentTelemetry);
  } catch (err) {
    env.status = "failed";
    env.error = err instanceof Error ? err.message : String(err);
    console.error("[ChatDispatcher/SDK] agent failed:", err);
    return;
  }

  // Upload the data URL → S3, get a permanent URL.
  let imageUrl: string;
  try {
    const tempDesignId = `chat-sdk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    imageUrl = await processDesignThumbnail(imageDataUrl, chat.userId).catch(() => imageDataUrl);
    if (!imageUrl || imageUrl.startsWith("data:")) {
      // processDesignThumbnail can no-op if input doesn't match its
      // exact contract; fall back to saving via the data URL directly.
      imageUrl = imageDataUrl;
    }
    void tempDesignId;
  } catch (err) {
    console.error("[ChatDispatcher/SDK] thumbnail upload failed:", err);
    imageUrl = imageDataUrl; // fall back to data URL — chat will still render it inline
  }

  // Create the Design row.
  let designId: string | undefined;
  try {
    const created = await prisma.design.create({
      data: {
        userId: chat.userId,
        prompt: String(prompt).slice(0, 4000),
        category: category ?? "social_post",
        size: `${finalWidth}x${finalHeight}`,
        style: env.args.style ?? "polished",
        imageUrl,
        canvasData: canvasDataJson,
        status: "COMPLETED",
        chatId: opts.chatId,
        branchId,
        metadata: JSON.stringify(agentTelemetry),
      },
    });
    designId = created.id;
  } catch (err) {
    console.error("[ChatDispatcher/SDK] failed to create Design row:", err);
  }

  env.status = "complete";
  env.designId = designId;
  env.imageUrl = imageUrl;
  env.width = finalWidth;
  env.height = finalHeight;
}

// ─── Legacy /api/ai/visual + reproduceTemplate path (pre-SDK) ─────────
async function dispatchDesignViaLegacy(
  env: Extract<DispatchEnvelope, { kind: "design" }>,
  opts: DispatchOpts,
): Promise<void> {
  const { mode, prompt, width, height, category, style, ctaText, referenceImageUrl, useBrandColors, qualityCheckEnabled, branchId } = env.args;

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

  const chatBrand = await loadChatBrandIdentity(opts.chatId);
  const visualBody: Record<string, unknown> = {
    prompt,
    category: category ?? "social_post",
    size: `${width}x${height}`,
    style: style ?? "polished",
    ctaText: ctaText ?? null,
    provider: referenceImageUrl ? "openai" : "xai",
    promptMode: "raw_brand",
    brandIdentity: chatBrand?.raw ?? null,
    channels: "Studio create chat",
    brandName: typeof chatBrand?.raw.name === "string" ? chatBrand.raw.name : null,
    brandColors: chatBrand?.colors ?? null,
    brandLogo: chatBrand?.logoUrl ?? null,
    contactInfo: chatBrand?.contactInfo ?? null,
    showBrandName: Boolean(chatBrand?.raw.name),
    showSocialIcons: Boolean(chatBrand?.handles),
    socialHandles: chatBrand?.handles ?? null,
    referenceImageUrl: referenceImageUrl ?? null,
    qualityCheckEnabled: qualityCheckEnabled === true,
    chatOutputMode: mode,
  };
  if (useBrandColors === false) visualBody.brandColors = null;

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
    env.error = visualData?.error?.message || `FlowAI image request failed (${visualRes.status})`;
    return;
  }

  let designId: string | undefined =
    visualData?.data?.design?.id || visualData?.data?.designId || visualData?.designId;
  const imageUrl: string | undefined =
    visualData?.data?.design?.imageUrl || visualData?.data?.imageUrl || visualData?.imageUrl;

  if (!imageUrl) {
    env.status = "failed";
    env.error = "FlowAI returned no usable image.";
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

      // If the user supplied a reference photo, run rembg on it and
      // pass the cutout in as a referenceImage. reproduceTemplate uses
      // these to FILL the image_placeholder slots in the editable
      // canvas. Without this the placeholder shows up empty in the
      // editor (the "Photo of pastor / speaker" dashed box).
      const referenceImages: string[] = [];
      if (referenceImageUrl) {
        try {
          const cutout = await cutoutAsDataUrl(referenceImageUrl);
          referenceImages.push(cutout);
        } catch (err) {
          console.warn("[ChatDispatcher] failed to prep ref cutout, using URL as-is:", err);
          referenceImages.push(referenceImageUrl);
        }
      }

      const reproduce = await reproduceTemplate(imageUrl, {
        customText: prompt,
        brandColors,
        brandFonts,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
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
    env.error = data?.error?.message || `FlowAI video request failed (${res.status})`;
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
    env.error = data?.error?.message || `FlowAI edit request failed (${res.status})`;
    return;
  }
  env.status = "complete";
  env.imageUrl = data?.remixedImageUrl;
  env.width = data?.width;
  env.height = data?.height;
}
