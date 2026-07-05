import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import {
  generateImageForRole,
  editImagesForRole,
  type ImageEditIntent,
} from "@/lib/ai/image-router";
import { imageGenerateRole, imageEditRole, imageReferenceRole } from "@/lib/ai/media-models";
import { getRecipeConfig } from "@/lib/ai/media-policy";
import { buildArtDirection } from "@/lib/ai/image-recipe";
import { currentDateDirective } from "@/lib/ai/date-context";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { saveDesignImage } from "@/lib/utils/file-storage";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { compositeBrandLogoOnImageBase64 } from "@/lib/media/brand-logo-compositor";
import { analyzeLogoPlacement } from "@/lib/media/analyze-logo-placement";
import type { ImageProvider } from "@/lib/constants/design-presets";

/**
 * Multi-Provider Visual Generation Pipeline
 *
 * Supports three AI image providers:
 *   - OpenAI (gpt-image-1): 1024x1024, 1536x1024, 1024x1536
 *   - xAI (grok-imagine-image): 9 aspect ratios (1:1 to 2:1)
 *   - Gemini (imagen-4.0-generate-001): 5 aspect ratios (1:1 to 16:9)
 *
 * Flow: Provider generates image → upscale to target → composite brand logo
 */

type EditReferenceMode = "adapt" | "exact" | "keep_face";
type EditIntent = "auto" | "improve" | "replace_subject";
type VisualQualityReview = {
  pass: boolean;
  score: number;
  summary: string;
  issues: string[];
  correctionPrompt: string;
};
type PipelineResult = {
  imageUrl: string;
  pipeline: "direct" | "edit";
  model: string;
  promptUsed: string;
  qualityReviews?: VisualQualityReview[];
};
type LogoPlacement = {
  x?: number;
  y?: number;
  sizePercent?: number;
};
type EditRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  canvasW: number;
  canvasH: number;
};

function normalizeEditReferenceMode(value: unknown): EditReferenceMode {
  if (value === "exact" || value === "keep_face") return value;
  return "adapt";
}

function normalizeEditIntent(value: unknown): EditIntent {
  if (value === "replace_subject" || value === "improve") return value;
  return "auto";
}

function normalizeQualityCheck(value: unknown): boolean {
  return value === true || value === "true" || value === "premium" || value === "quality";
}

function normalizeLogoPlacement(value: unknown): LogoPlacement | null {
  if (!value || typeof value !== "object") return null;
  const placement = value as Record<string, unknown>;
  const normalized: LogoPlacement = {};
  if (typeof placement.x === "number" && Number.isFinite(placement.x)) normalized.x = placement.x;
  if (typeof placement.y === "number" && Number.isFinite(placement.y)) normalized.y = placement.y;
  if (typeof placement.sizePercent === "number" && Number.isFinite(placement.sizePercent)) {
    normalized.sizePercent = placement.sizePercent;
  }
  return normalized;
}

function inferEditIntent(prompt: string, editIntent: EditIntent): Exclude<EditIntent, "auto"> {
  if (editIntent === "replace_subject" || editIntent === "improve") return editIntent;
  const normalized = prompt.toLowerCase();
  const looksLikeReplacement =
    /\b(replace|swap|substitute)\b/.test(normalized) ||
    /\b(use|insert|put|add)\b[\s\S]{0,60}\b(reference|photo|image|person|product|logo|object)\b/.test(normalized) ||
    /\b(change)\b[\s\S]{0,60}\b(person|people|photo|image|object|product|background)\b/.test(normalized);
  return looksLikeReplacement ? "replace_subject" : "improve";
}

function shouldUseEveryReplacementReference(prompt: string, referenceCount: number): boolean {
  if (referenceCount < 2) return false;
  const normalized = prompt.toLowerCase();
  return (
    /\b(replace|swap|substitute|change|use|insert|put|add)\b/.test(normalized) &&
    /\b(photo|photos|image|images|picture|pictures|these|all|reference|references)\b/.test(normalized)
  );
}

function isBackgroundReplacementIntent(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return (
    /\b(background|backgroung|backgroud|backgrond|backdrop|bg)\b/.test(normalized) &&
    /\b(replace|swap|change|use|make)\b/.test(normalized)
  );
}

function shouldLockFaceButAllowStyling(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return /\b(cloth|clothes|clothing|outfit|attire|dress|shirt|suit|uniform|wear|wearing|robe|jacket)\b/.test(normalized);
}

/**
 * Run rembg on a reference buffer and return a transparent-background
 * cutout for clean compositing onto a generated background. Falls back
 * to null when rembg isn't installed (Windows dev) or fails — caller
 * uses the raw buffer in that case.
 */
async function stripReferenceBg(refBuffer: Buffer): Promise<Buffer | null> {
  if (!isRembgAvailable()) return null;
  const tmpDir = path.join(os.tmpdir(), "fs-bg");
  try {
    await mkdir(tmpDir, { recursive: true });
    const inPath = path.join(tmpDir, `${randomUUID()}.png`);
    const normalized = await sharp(refBuffer).png().toBuffer();
    await writeFile(inPath, normalized);
    try {
      const result = await removeBackground(inPath, { model: "u2net" });
      const cutout = await readFile(result.outputPath);
      void unlink(inPath).catch(() => undefined);
      void unlink(result.outputPath).catch(() => undefined);
      return cutout;
    } finally {
      void unlink(inPath).catch(() => undefined);
    }
  } catch (err) {
    console.warn("[Visual] rembg failed, using raw ref:", err);
    return null;
  }
}

/** Resolve an image URL (S3 presigned, /uploads/, or /public/) to a Buffer */
async function resolveImageToBuffer(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("data:")) {
    const b64 = urlOrPath.replace(/^data:image\/[^;]+;base64,/, "");
    return Buffer.from(b64, "base64");
  }
  if (urlOrPath.startsWith("http")) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const localPath = urlOrPath.startsWith("/")
    ? path.join(process.cwd(), "public", urlOrPath)
    : path.join(process.cwd(), "public", urlOrPath);
  return readFile(localPath);
}

async function addSoftShadow(subjectBuffer: Buffer): Promise<Buffer> {
  const subjectWithAlpha = await sharp(subjectBuffer).ensureAlpha().png().toBuffer();
  const meta = await sharp(subjectWithAlpha).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  const alphaShadow = await sharp(subjectWithAlpha)
    .extractChannel("alpha")
    .blur(18)
    .toColourspace("b-w")
    .toBuffer();
  const shadowLayer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: alphaShadow, blend: "dest-in" }])
    .ensureAlpha()
    .png()
    .toBuffer();
  const dimmedShadow = await sharp(shadowLayer)
    .composite([{
      input: Buffer.from([0, 0, 0, Math.round(255 * 0.28)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: "dest-in",
    }])
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: width + 28,
      height: height + 28,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: dimmedShadow, left: 14, top: 20 },
      { input: subjectWithAlpha, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function uniqueImageUrls(urls: Array<string | null | undefined>, max = 4): string[] {
  return urls
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .map((url) => url.trim())
    .filter((url, index, arr) => arr.indexOf(url) === index)
    .slice(0, max);
}

async function getBase64ImageDimensions(base64: string, fallbackW: number, fallbackH: number) {
  try {
    const meta = await sharp(Buffer.from(base64, "base64")).metadata();
    return { width: meta.width || fallbackW, height: meta.height || fallbackH };
  } catch {
    return { width: fallbackW, height: fallbackH };
  }
}

async function compositeReferenceSubject(
  imageBase64: string,
  subjectSource: string,
  targetSize: string,
): Promise<string> {
  const [fallbackW, fallbackH] = targetSize.split("x").map(Number);
  const bgBuffer = Buffer.from(imageBase64, "base64");
  const bgMeta = await sharp(bgBuffer).metadata();
  const bgW = bgMeta.width || fallbackW;
  const bgH = bgMeta.height || fallbackH;
  const originalSubject = await resolveImageToBuffer(subjectSource);
  const subjectMeta = await sharp(originalSubject).metadata();
  const sourceW = subjectMeta.width || 1;
  const sourceH = subjectMeta.height || 1;
  const sourceRatio = sourceW / sourceH;
  const canvasRatio = bgW / bgH;
  const treatAsWidePhoto = sourceRatio > 1.18 && canvasRatio < 1.45;

  let subjectLayer: Buffer;
  let left: number;
  let top: number;

  if (treatAsWidePhoto) {
    const maxW = Math.round(bgW * 0.68);
    const maxH = Math.round(bgH * 0.38);
    const framedSubject = await sharp(originalSubject)
      .rotate()
      .resize(maxW, maxH, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    subjectLayer = await addSoftShadow(framedSubject);
    const layerMeta = await sharp(subjectLayer).metadata();
    const layerW = layerMeta.width || maxW;
    const layerH = layerMeta.height || maxH;
    left = Math.round((bgW - layerW) / 2);
    top = Math.round(bgH * 0.055);
  } else {
    const cutout = await stripReferenceBg(originalSubject);
    const subjectSrc = cutout || originalSubject;
    const maxW = Math.round(bgW * (cutout ? 0.44 : 0.38));
    const maxH = Math.round(bgH * (cutout ? 0.78 : 0.66));
    const resized = await sharp(subjectSrc)
      .rotate()
      .resize(maxW, maxH, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    subjectLayer = await addSoftShadow(resized);
    const layerMeta = await sharp(subjectLayer).metadata();
    const layerW = layerMeta.width || maxW;
    const layerH = layerMeta.height || maxH;
    left = Math.round(bgW * 0.54);
    top = Math.round(bgH - layerH - bgH * 0.06);
    if (left + layerW > bgW - Math.round(bgW * 0.035)) {
      left = bgW - layerW - Math.round(bgW * 0.035);
    }
  }

  const layerMeta = await sharp(subjectLayer).metadata();
  const layerW = layerMeta.width || 1;
  const layerH = layerMeta.height || 1;
  const safeLeft = Math.max(0, Math.min(left, bgW - layerW));
  const safeTop = Math.max(0, Math.min(top, bgH - layerH));
  const composited = await sharp(bgBuffer)
    .composite([{ input: subjectLayer, left: safeLeft, top: safeTop }])
    .png()
    .toBuffer();
  return composited.toString("base64");
}

// POST /api/ai/visual
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI visual design", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const result = await runVisualForUser(body, {
      userId: session.userId,
      isAdmin: !!session.adminId,
      adminId: session.adminId ?? null,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Visual generation error:", error);
    const rawMessage = error instanceof Error ? error.message : "";
    const safeMessage = /api[_\s-]?key|authorization|bearer|token/i.test(rawMessage)
      ? "The selected image provider is not configured correctly."
      : rawMessage || "Failed to generate visual design";
    return NextResponse.json(
      { success: false, error: { message: safeMessage } },
      { status: 500 }
    );
  }
}

/** Context for a server-side visual generation (route or Flow-AI agent). */
export interface VisualUserContext {
  userId: string;
  isAdmin: boolean;
  adminId?: string | null;
  /**
   * When true, the engine does NOT run its own credit gate or deduction — the
   * CALLER is responsible for billing. Used by the content-automation /
   * scheduler paths, which charge per-occurrence with their own bookkeeping and
   * must not be double-charged. The Design / MediaFile rows are still created.
   */
  skipCredits?: boolean;
}

/**
 * Shared anti-"card-on-a-surface" composition rule. Image models — especially
 * xAI grok-imagine and template-edit passes — love to render the design as a
 * rounded translucent card floating on a separate blurry background. This
 * forbids that on EVERY generation path (both prompt builders).
 */
const NO_NESTING_RULE =
  "ABSOLUTELY NO NESTING / NO CARD-ON-A-SURFACE: the design must NOT appear as a card, flyer, poster, panel, or rounded translucent sheet placed ON TOP of another background. There is exactly ONE layer — the design itself — filling every pixel edge to edge. No outer background, no margins, no rounded corners on the overall image, no drop shadow beneath a floating panel, no 'poster on a wall' or 'flyer on a desk' mockup effect.";

/**
 * Core visual-design generation shared by the /api/ai/visual route AND the
 * Flow-AI agent's create_branded_design tool. Runs credit check → Design row
 * → full pipeline (incl. quality-check loop + face-identity lock + reference
 * compositing + brand-logo overlay) → persistence → Media Library save.
 * Returns a { status, body } pair; throws on unexpected pipeline errors so
 * the caller can map to a 500.
 */
export async function runVisualForUser(
  // Matches the original handler's untyped JSON body so the existing
  // destructure + pipeline param construction type-check unchanged.
  body: Record<string, any>,
  ctx: VisualUserContext,
): Promise<{ status: number; body: Record<string, unknown> }> {
  // Shim so the original handler body (which referenced `session`) keeps
  // working unchanged whether called from the route or the agent.
  const session = { userId: ctx.userId, adminId: ctx.adminId ?? null };
  const {
      prompt, category, size, style,
      brandColors, heroType, textMode,
      brandLogo, brandName, contactInfo,
      showBrandName, showSocialIcons, socialHandles,
      templateImageUrl,
      referenceImageUrl,
      referenceImageUrls,
      logoSizePercent,
      logoPlacement,
      logoReferenceUrl,
      ctaText,
      editImageUrl,
      editRegion,
      editIntent,
      editReferenceMode,
      editReferenceImageUrl,
      editReferenceImageUrls,
      provider,
      strictProvider,
      tier: tierInput,
      promptMode,
      brandIdentity,
      agentDesignTemplate,
      channels,
      qualityCheck,
      qualityCheckEnabled,
      compositeReferenceSubject,
    } = body;

    if (!prompt || !category || !size) {
      return {
        status: 400,
        body: { success: false, error: { message: "Prompt, category, and size are required" } },
      };
    }

    const isAdmin = ctx.isAdmin;
    const qualityCheckRequested = normalizeQualityCheck(qualityCheckEnabled ?? qualityCheck);
    const baseCreditCost = await getDynamicCreditCost("AI_VISUAL_DESIGN");
    const creditCost = baseCreditCost * (qualityCheckRequested ? 3 : 1);
    const currentUser = !isAdmin
      ? await prisma.user.findUnique({
          where: { id: session.userId },
          select: { aiCredits: true, freeCredits: true },
        })
      : null;

    if (!isAdmin && !ctx.skipCredits) {
      if (!currentUser) {
        return {
          status: 403,
          body: { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "User not found.", cost: creditCost } },
        };
      }
      const purchasedCredits = Math.max(0, currentUser.aiCredits - (currentUser.freeCredits || 0));
      if (purchasedCredits < creditCost) {
        return {
          status: 403,
          body: {
            success: false,
            error: {
              code: currentUser.aiCredits >= creditCost && (currentUser.freeCredits || 0) > 0
                ? "FREE_CREDITS_RESTRICTED"
                : "INSUFFICIENT_CREDITS",
              message: qualityCheckRequested
                ? `Quality check requires ${creditCost} credits (3x the regular ${baseCreditCost}). You have ${purchasedCredits} purchased credits remaining.`
                : `This requires ${creditCost} credits. You have ${purchasedCredits} purchased credits remaining.`,
              cost: creditCost,
            },
          },
        };
      }
    }

    // Create design record
    const design = await prisma.design.create({
      data: {
        userId: session.userId,
        prompt,
        category,
        size,
        style: style || null,
        status: "GENERATING",
        metadata: JSON.stringify({
          brandColors: brandColors || null,
          agentDesignTemplate:
            agentDesignTemplate && typeof agentDesignTemplate === "object" && !Array.isArray(agentDesignTemplate)
              ? agentDesignTemplate
              : null,
        }),
      },
    });

    const [width, height] = size.split("x").map(Number);
    const tier: "standard" | "premium" = tierInput === "premium" ? "premium" : "standard";
    const selectedProvider: ImageProvider = provider || "xai";
    console.log(`[Visual] Provider: ${selectedProvider} for ${width}x${height} (ratio ${(width / height).toFixed(2)})`);

    const pipelineParams = {
      prompt, category, width, height, style,
      brandColors, heroType, textMode,
      brandLogo, brandName, contactInfo,
      showBrandName, showSocialIcons, socialHandles,
      templateImageUrl,
      referenceImageUrl,
      referenceImageUrls: Array.isArray(referenceImageUrls)
        ? referenceImageUrls.filter((url: unknown): url is string => typeof url === "string" && url.trim().length > 0).slice(0, 4)
        : [],
      logoSizePercent: logoSizePercent || null,
      logoPlacement: normalizeLogoPlacement(logoPlacement),
      logoReferenceUrl: typeof logoReferenceUrl === "string" && logoReferenceUrl.trim() ? logoReferenceUrl.trim() : null,
      compositeReferenceSubject: compositeReferenceSubject === true,
      ctaText: ctaText || null,
      editImageUrl: editImageUrl || null,
      editRegion: editRegion || null,
      editIntent: normalizeEditIntent(editIntent),
      editReferenceMode: normalizeEditReferenceMode(editReferenceMode),
      editReferenceImageUrls: Array.isArray(editReferenceImageUrls)
        ? editReferenceImageUrls.filter((url: unknown): url is string => typeof url === "string" && url.trim().length > 0).slice(0, 4)
        : typeof editReferenceImageUrl === "string" && editReferenceImageUrl.trim()
          ? [editReferenceImageUrl]
          : [],
      provider: selectedProvider,
      strictProvider: strictProvider === true,
      tier,
      promptMode: promptMode === "raw_brand" ? "raw_brand" : "direct",
      brandIdentity: brandIdentity && typeof brandIdentity === "object" ? brandIdentity : null,
      channels: typeof channels === "string" ? channels : null,
    } satisfies PipelineParams;

    // Generate the design
    const result = await runPipelineWithOptionalQualityCheck(pipelineParams, qualityCheckRequested);

    // Save image to disk
    const imageFileUrl = await saveDesignImage(result.imageUrl, design.id, "png");

    // Update design record with file URL
    const updatedDesign = await prisma.design.update({
      where: { id: design.id },
      data: {
        imageUrl: imageFileUrl,
        status: "COMPLETED",
        metadata: JSON.stringify({
          brandColors: brandColors || null,
          pipeline: result.pipeline,
          provider: selectedProvider,
          qualityCheck: qualityCheckRequested,
          qualityReviews: result.qualityReviews || [],
        }),
      },
    });

    // Deduct credits (unless the caller bills itself — see ctx.skipCredits).
    if (!isAdmin && !ctx.skipCredits) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: creditCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter: (currentUser?.aiCredits || 0) - creditCost,
            referenceType: "ai_visual",
            referenceId: design.id,
            description: qualityCheckRequested
              ? `Visual design generation with quality check: ${category}`
              : `Visual design generation: ${category}`,
          },
        }),
      ]);
    }

    // Save to Media Library
    const fileSize = Math.round((result.imageUrl.length - result.imageUrl.indexOf(",") - 1) * 0.75);
    await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: `design-${design.id}.png`,
        originalName: `${category} Design.png`,
        url: imageFileUrl,
        type: "image",
        mimeType: "image/png",
        size: fileSize,
        width,
        height,
        tags: JSON.stringify(["design", "ai-generated", category]),
        metadata: JSON.stringify({ designId: design.id, style: style || "modern", provider: selectedProvider }),
      },
    });

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "visual_design",
        model: result.model,
        inputTokens: result.promptUsed.length,
        outputTokens: 0,
        costCents: 0,
        prompt: prompt.substring(0, 500),
        response: `Provider: ${selectedProvider}`,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        data: await presignAllUrls({
          design: {
            id: updatedDesign.id,
            prompt: updatedDesign.prompt,
            category: updatedDesign.category,
            size: updatedDesign.size,
            style: updatedDesign.style,
            imageUrl: imageFileUrl,
            pipeline: result.pipeline,
            status: updatedDesign.status,
            createdAt: updatedDesign.createdAt.toISOString(),
          },
          creditsUsed: isAdmin || ctx.skipCredits ? 0 : creditCost,
          creditsRemaining: isAdmin || ctx.skipCredits ? (currentUser?.aiCredits ?? 0) : (currentUser?.aiCredits || 0) - creditCost,
          qualityCheck: qualityCheckRequested,
          qualityReview: result.qualityReviews?.at(-1) || null,
        }),
      },
    };
}

// ═══════════════════════════════════════════════════════════════
// DIRECT PIPELINE — AI provider generates the complete design
// ═══════════════════════════════════════════════════════════════

interface PipelineParams {
  prompt: string;
  category: string;
  width: number;
  height: number;
  style: string | null;
  brandColors: Record<string, string> | null;
  heroType: string;
  textMode: string;
  brandLogo: string | null;
  brandName: string | null;
  contactInfo: { email?: string | null; phone?: string | null; website?: string | null; address?: string | null } | null;
  showBrandName?: boolean;
  showSocialIcons?: boolean;
  socialHandles?: Record<string, string> | null;
  templateImageUrl?: string | null;
  referenceImageUrl?: string | null;
  referenceImageUrls?: string[];
  logoSizePercent?: number | null;
  logoPlacement?: LogoPlacement | null;
  compositeReferenceSubject?: boolean;
  /**
   * When set, the REAL brand logo is handed to the image model as a reference
   * DURING generation (so the model lays the design's text out AROUND the logo)
   * instead of being blindly composited on top afterward. This is the text-safe
   * way to let the AI place the logo — a post-generation edit would re-render and
   * garble the headline/body text. When set, the post-gen composite is skipped.
   */
  logoReferenceUrl?: string | null;
  ctaText?: string | null;
  editImageUrl?: string | null;
  editIntent?: EditIntent;
  editReferenceMode?: EditReferenceMode;
  editReferenceImageUrls?: string[];
  /**
   * Optional pinpoint region for edit mode. Coordinates are in CANVAS pixels
   * (so the model gets unambiguous bounds even when the canvas isn't 1080×1080).
   * canvasW / canvasH let us convert to percentages so the prompt is robust
   * to provider rescaling.
   */
  editRegion?: EditRegion | null;
  // Note: referenceImageUrl is declared once above (it's already used by
  // the GENERATE pipeline for hybrid template/reference compositing). When
  // present in EDIT mode, the call is auto-routed to a multi-image-capable
  // provider (Gemini) so the AI can blend the reference into the canvas —
  // see runEditPipeline below.
  provider: ImageProvider;
  strictProvider?: boolean;
  /** User-facing media tier — drives the global model policy (generate/edit role). */
  tier: "standard" | "premium";
  promptMode?: "direct" | "raw_brand";
  brandIdentity?: Record<string, unknown> | null;
  channels?: string | null;
}

function compactPromptValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .slice(0, 8)
      .map((item) => (typeof item === "string" ? item.trim() : item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== null && item !== undefined && item !== "" && !(Array.isArray(item) && item.length === 0))
        .slice(0, 18)
    );
  }
  return value;
}

function sanitizeBrandIdentityForPrompt(value: unknown, hasRealLogo: boolean): Record<string, unknown> {
  const compacted = compactPromptValue(value || {});
  const source = compacted && typeof compacted === "object" && !Array.isArray(compacted)
    ? compacted as Record<string, unknown>
    : {};
  const blocked = /(^|_)(logo|iconLogo|brandLogo|logoUrl|iconLogoUrl|wordmark|emblem|seal|crest)(_|$)/i;
  const sanitized = Object.fromEntries(
    Object.entries(source).filter(([key, item]) => {
      if (blocked.test(key)) return false;
      if (typeof item === "string" && /^https?:\/\//i.test(item) && /(logo|wordmark|brand|icon)/i.test(key)) return false;
      return true;
    })
  );
  if (hasRealLogo) sanitized.hasRealLogoForPostComposite = true;
  return sanitized;
}

/**
 * Swap printed-object artifact nouns ("flyer", "poster", "brochure"…) for the
 * neutral "design" in the user's prompt. Naming the output as one of these
 * triggers a strong "printed sheet photographed on a surface" prior in xAI /
 * Imagen / Nano Banana (Gemini 2.5 Flash Image) — they render a flyer lying on
 * a table instead of a full-frame graphic. See feedback_no_text_rules_in_image_prompts.
 */
function sanitizeArtifactNouns(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bbusiness cards?\b/gi, "design")
    .replace(/\b(flyers?|fliers?|posters?|postcards?|leaflets?|brochures?|pamphlets?|billboards?)\b/gi, "design");
}

function buildRawBrandPrompt(params: PipelineParams): string {
  const brandIdentity = sanitizeBrandIdentityForPrompt(params.brandIdentity || {}, Boolean(params.brandLogo));
  const fallbackBrand = compactPromptValue({
    name: params.brandName || undefined,
    colors: params.brandColors || undefined,
    handles: params.socialHandles || undefined,
    contact: params.contactInfo || undefined,
  });

  return [
    // Concise brief. The heavy composition/typography/full-bleed/logo rules live
    // in the shared art-direction recipe (buildArtDirection), appended by the
    // caller — keeping THIS prompt short so it stays under xAI's 8000-char limit
    // (otherwise xAI 400s and the campaign silently falls back to a weaker model).
    "You are a senior art director. Design a COMPLETE, professionally art-directed branded marketing graphic (not a plain photo with a caption) organized into clear zones: eyebrow/tagline, bold hero title, subhead, concise body, optional badge, CTA bar, and a styled footer bar. Build the whole palette from the brand colors.",
    "CONTACT DETAILS: present the brand's contact info as a styled footer strip, using ONLY the EXACT values from the brand context below — copy them character-for-character; never invent or use placeholders (no '555-…', 'info@example', '123 Main St', fake @handle). Omit any value not provided.",
    "",
    "Marketing image context",
    `Frame size: ${params.width}x${params.height}px (compose to fill it edge-to-edge)`,
    currentDateDirective(),
    `Use case: ${String(params.category).replace(/_/g, " ")}`,
    params.channels ? `Channels: ${params.channels}` : null,
    params.style ? `Style preference: ${params.style}` : null,
    params.templateImageUrl
      ? "A design template image is attached for INSPIRATION ONLY — it conveys a general LAYOUT/STYLE DIRECTION and IDEA, it is NOT to be copied. Do NOT reproduce its exact text, photos, logo, people, or products. CRITICAL — COLORS: ignore the template's colors entirely and use the USER'S OWN BRAND COLORS (from the brand context above) for the whole palette — background, accents, bars, shapes. The result must look like the USER'S brand, not the template. Treat the template only as a loose mood reference for composition/feel, then create an ORIGINAL design driven by the user's prompt + their real brand kit."
      : null,
    params.referenceImageUrls?.length
      ? `Reference assets: ${params.referenceImageUrls.length + (params.referenceImageUrl ? 1 : 0)} uploaded images. Treat them as exact product/person/site sources, not loose inspiration.`
      : params.referenceImageUrl
        ? "Reference assets: 1 uploaded image. Treat it as the exact product/person/site source, not loose inspiration."
        : null,
    params.compositeReferenceSubject && (params.referenceImageUrl || params.referenceImageUrls?.length)
      ? "Exact subject plan: FlowSmartly will place the first uploaded user reference into the final design after generation. Build a polished empty photo/product zone for it; do not generate a substitute person, group, face, product, logo, or lookalike."
      : null,
    "",
    "Brand identity:",
    JSON.stringify(Object.keys(brandIdentity).length > 0 ? brandIdentity : fallbackBrand),
    params.logoReferenceUrl
      ? "Brand logo handling (CRITICAL): the LAST attached reference image is the brand's REAL logo. PLACE THAT EXACT logo into THIS design as the real brand mark — reproduce it faithfully (same shapes, colors, and lettering; do NOT redraw, restyle, recolor, crop, or invent it). Position it cleanly in the header / a top corner at a tasteful size with generous clear margin, and arrange ALL headline, subhead, body, and contact text so that NOTHING overlaps, touches, or crowds the logo — leave a calm clear zone around it. The logo is part of the image you generate now; it will NOT be added afterward, so it must already be present, sharp, and unobstructed. Do not also render the brand name as a separate wordmark next to it."
      : params.brandLogo
        ? "Brand logo handling: the real brand logo file is provided to FlowSmartly separately and may be composited after generation. Do not invent, redraw, approximate, stylize, or copy any logo/wordmark/emblem from the template. Do not draw a visible logo placeholder, blank or white logo box, dashed frame, label, watermark, or reserved logo-space indicator; let the design and background remain natural anywhere a logo may later sit."
        : "Brand logo handling: no real logo file was provided; use brand name text only if needed, never create a fake emblem.",
    "",
    "User prompt:",
    sanitizeArtifactNouns(params.prompt),
  ]
    .filter((line) => line !== null)
    .join("\n");
}


function parseJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function imageToAnthropicBlock(input: string | Buffer) {
  const buffer = typeof input === "string"
    ? Buffer.from(input.replace(/^data:image\/[^;]+;base64,/, ""), "base64")
    : input;
  const normalized = await sharp(buffer)
    .rotate()
    .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/png" as const,
      data: normalized.toString("base64"),
    },
  };
}

function normalizeQualityReview(value: Record<string, unknown> | null): VisualQualityReview {
  const score = Math.max(0, Math.min(100, Number(value?.score ?? 0) || 0));
  const issues = Array.isArray(value?.issues)
    ? value.issues.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
    : [];
  const correctionPrompt = typeof value?.correctionPrompt === "string"
    ? value.correctionPrompt.trim().slice(0, 1200)
    : "";
  const summary = typeof value?.summary === "string"
    ? value.summary.trim().slice(0, 500)
    : "";
  const pass = value?.pass === true || (score >= 82 && issues.length === 0);
  return {
    pass,
    score,
    summary: summary || (pass ? "Quality check passed." : "Quality check found issues."),
    issues,
    correctionPrompt,
  };
}

async function evaluateGeneratedImageQuality(
  params: PipelineParams,
  result: PipelineResult,
  attempt: number,
): Promise<VisualQualityReview> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_BACKUP_API_KEY) {
    return {
      pass: true,
      score: 82,
      summary: "Quality review unavailable; no vision reviewer key is configured.",
      issues: [],
      correctionPrompt: "",
    };
  }

  try {
    const context = compactPromptValue({
      userPrompt: params.prompt,
      category: params.category,
      size: `${params.width}x${params.height}`,
      style: params.style,
      textMode: params.textMode,
      ctaText: params.ctaText,
      brandName: params.brandName,
      brandColors: params.brandColors,
      brandIdentity: params.brandIdentity,
      contactInfo: params.contactInfo,
      channels: params.channels,
      editMode: Boolean(params.editImageUrl),
      editIntent: params.editIntent,
      referenceCount:
        (params.editReferenceImageUrls?.length || 0) +
        (params.referenceImageUrls?.length || 0) +
        (params.referenceImageUrl ? 1 : 0) +
        (params.templateImageUrl ? 1 : 0),
    });

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: [
          "You are FlowSmartly's internal image quality reviewer.",
          "Compare the generated image with the user's prompt and provided production context.",
          "Pass only if the image is professional, ready to use, readable, visually coherent, and clearly follows the user's request.",
          "Fail if there are major spelling/layout problems, unreadable text, wrong subject, missing required brand/contact/details, obvious AI artifacts, watermarks/provider branding, wrong format, or a rough pasted/overlay look.",
          "Do not be overly picky about minor style preferences. Focus on real user-facing defects.",
          "",
          `Generation attempt: ${attempt}`,
          "Production context JSON:",
          JSON.stringify(context, null, 2),
          "",
          "Return ONLY JSON in this exact shape:",
          `{"pass":true,"score":92,"summary":"short reason","issues":[],"correctionPrompt":""}`,
          "If failing, correctionPrompt must be a concise instruction that can be appended to the next image-generation prompt.",
        ].join("\n"),
      },
      { type: "text", text: "Generated image to review:" },
      await imageToAnthropicBlock(result.imageUrl),
    ];

    const referenceSources = [
      params.editImageUrl,
      params.referenceImageUrl,
      params.templateImageUrl,
      ...(params.referenceImageUrls || []),
      ...(params.editReferenceImageUrls || []),
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 6);

    for (let i = 0; i < referenceSources.length; i++) {
      try {
        const ref = await resolveImageToBuffer(referenceSources[i]);
        content.push({ type: "text", text: `Reference/source image ${i + 1}:` });
        content.push(await imageToAnthropicBlock(ref));
      } catch (err) {
        console.warn("[Visual/Quality] Failed to load reference for review:", err);
      }
    }

    const editReferenceCount = params.editReferenceImageUrls?.length || 0;
    if (params.editImageUrl && editReferenceCount > 0) {
      content.push({
        type: "text",
        text: [
          "Human identity preservation requirement:",
          "If any user reference image contains a human face, fail the result if the generated image uses a similar-looking or invented person instead of the real reference identity.",
          "Changing clothes, pose, lighting, background, or design placement is allowed only if the face/head identity remains recognizably the same person from the uploaded reference.",
        ].join("\n"),
      });
    }

    if (params.editImageUrl && editReferenceCount > 1 && shouldUseEveryReplacementReference(params.prompt, editReferenceCount)) {
      content.push({
        type: "text",
        text: [
          `Multi-reference replacement requirement: the generated image must visibly use all ${editReferenceCount} user reference images.`,
          "Fail if any provided reference photo is missing, replaced by a stock/generated substitute, merged into another person/photo, or only used as loose inspiration.",
          "Also fail if existing design text, dates, email, address, brand name, or logo became misspelled, truncated, blurry, or rewritten.",
        ].join("\n"),
      });
    }

    const createParams = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      temperature: 0,
      messages: [{ role: "user" as const, content }],
    };
    let response: Anthropic.Message;
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      response = await anthropic.messages.create(createParams as unknown as Parameters<typeof anthropic.messages.create>[0]) as Anthropic.Message;
    } catch (primaryErr: unknown) {
      const status = (primaryErr as { status?: number }).status;
      if ((status === 401 || status === 403 || status === 429 || status === 500 || status === 503 || status === 529) && process.env.ANTHROPIC_BACKUP_API_KEY) {
        const backupClient = new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY });
        response = await backupClient.messages.create(createParams as unknown as Parameters<typeof backupClient.messages.create>[0]) as Anthropic.Message;
      } else {
        throw primaryErr;
      }
    }

    const text = response.content.find((block): block is Anthropic.TextBlock => block.type === "text")?.text || "";
    const review = normalizeQualityReview(parseJsonFromText(text));
    console.log(`[Visual/Quality] attempt=${attempt} pass=${review.pass} score=${review.score} summary="${review.summary}"`);
    return review;
  } catch (err) {
    console.warn("[Visual/Quality] Review failed; delivering generated image without blocking:", err);
    return {
      pass: true,
      score: 82,
      summary: "Quality review could not complete, so the generated image was delivered.",
      issues: [],
      correctionPrompt: "",
    };
  }
}

async function runSinglePipeline(params: PipelineParams): Promise<PipelineResult> {
  return params.promptMode === "raw_brand"
    ? runRawBrandPipeline(params)
    : runDirectPipeline(params);
}

async function runPipelineWithOptionalQualityCheck(
  params: PipelineParams,
  qualityCheckEnabled: boolean,
): Promise<PipelineResult> {
  let currentParams = params;
  let result = await runSinglePipeline(currentParams);
  if (!qualityCheckEnabled) return result;

  const reviews: VisualQualityReview[] = [];
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const review = await evaluateGeneratedImageQuality(currentParams, result, attempt);
    reviews.push(review);
    if (review.pass) {
      return { ...result, qualityReviews: reviews };
    }

    if (attempt === maxAttempts) {
      throw new Error(
        `Quality check could not approve the generated image after ${maxAttempts} attempts. ${review.summary}`
      );
    }

    const correction = review.correctionPrompt || review.issues.join("; ") || review.summary;
    currentParams = {
      ...params,
      prompt: [
        params.prompt,
        "",
        "Quality review correction for regeneration:",
        correction,
        "Regenerate the image so it fixes the issues while preserving the user's original intent, brand context, required wording, and format.",
      ].join("\n"),
    };
    console.log(`[Visual/Quality] Regenerating attempt ${attempt + 1} with correction: ${correction.slice(0, 180)}`);
    result = await runSinglePipeline(currentParams);
  }

  return { ...result, qualityReviews: reviews };
}

async function runRawBrandPipeline(params: PipelineParams) {
  // Apply the SAME art-direction recipe as the direct pipeline so the raw_brand
  // path (used by Campaign Studio posts, content automations, the scheduler)
  // hits the full-bleed / quality / single-logo bar too — not just the Studio
  // "direct" path. singleLogo(model draws none) only when we post-composite the
  // real logo; when the logo is handed to the model as a generation reference
  // (logoReferenceUrl) the model must place THAT logo, so hasLogo=false.
  const recipe = await getRecipeConfig();
  const willCompositeLogo = !!params.brandLogo && !params.logoReferenceUrl;
  const recipeText = buildArtDirection({ recipe, hasLogo: willCompositeLogo });
  // HARD CAP for xAI: its API rejects prompts > 8000 chars, which would silently
  // drop Standard from xAI to a weaker fallback. Guarantee we stay under it while
  // ALWAYS keeping the full recipe (quality rules) and the tail of the brand
  // prompt (which ends with the user's EXACT copy). Only the middle brand-context
  // (products/keywords/etc.) is trimmed if needed. [[image-pipeline-providers]]
  const XAI_SAFE = 7800;
  let base = buildRawBrandPrompt(params);
  const budget = XAI_SAFE - recipeText.length - 4;
  if (base.length > budget) {
    const head = base.slice(0, Math.floor(budget * 0.45));
    const tail = base.slice(base.length - Math.floor(budget * 0.5));
    base = `${head}\n…\n${tail}`;
  }
  const promptUsed = `${base}\n\n${recipeText}`;
  console.log(`[Visual] Raw brand pipeline via ${params.provider} — prompt length ${promptUsed.length}`);
  let base64: string | null;
  let model: string;
  const subjectReferenceUrls = params.compositeReferenceSubject
    ? uniqueImageUrls([params.referenceImageUrl, ...(params.referenceImageUrls || [])], 3)
    : [];
  const referenceUrls = params.compositeReferenceSubject
    ? uniqueImageUrls([params.templateImageUrl], 1)
    : uniqueImageUrls([
        params.templateImageUrl,
        params.referenceImageUrl,
        ...(params.referenceImageUrls || []),
        // The brand logo handed in as a GENERATION reference (not a post-composite)
        // so the model lays text out around it. Appended LAST so it's the final
        // reference the prompt's logo clause refers to.
        params.logoReferenceUrl || null,
      ], 5);

  if (referenceUrls.length > 0) {
    const refBuffers = await Promise.all(referenceUrls.map((url) => resolveImageToBuffer(url)));
    // A reference-photo/logo DESIGN (generating a NEW rich design that incorporates
    // the reference) — route via the xAI-first design_reference role, NOT the
    // Gemini-first surgical-edit role. xAI preserves identity + renders cleaner
    // text on ornate flyers (July-2026 reference bake-off).
    const edited = await editImagesForRole(imageReferenceRole(params.tier), promptUsed, refBuffers, params.width, params.height, {
      quality: "high",
      intent: params.compositeReferenceSubject ? "creative" : "exact",
    });
    base64 = edited.base64;
    model = edited.model;
  } else {
    const generated = await generateImageForRole(
      imageGenerateRole(params.tier),
      promptUsed,
      params.width,
      params.height,
      { quality: "high" },
    );
    base64 = generated.base64;
    model = generated.model;
  }

  if (!base64) {
    throw new Error("FlowAI did not return a usable image.");
  }

  let finalBase64 = base64;
  let finalSize = await getBase64ImageDimensions(finalBase64, params.width, params.height);

  try {
    finalBase64 = await trimWhiteBorder(finalBase64);
    finalSize = await getBase64ImageDimensions(finalBase64, params.width, params.height);
  } catch (trimErr) {
    console.warn("[Visual] Raw brand auto-trim failed, using original:", trimErr);
  }

  if (params.compositeReferenceSubject && subjectReferenceUrls[0]) {
    try {
      console.log("[Visual] Compositing exact user reference subject after raw brand generation");
      finalBase64 = await compositeReferenceSubject(
        finalBase64,
        subjectReferenceUrls[0],
        `${finalSize.width}x${finalSize.height}`,
      );
      finalSize = await getBase64ImageDimensions(finalBase64, finalSize.width, finalSize.height);
    } catch (subjectErr) {
      console.error("[Visual] Exact subject compositing failed; delivering generated design:", subjectErr);
    }
  }

  // Skip the blind post-composite when the logo was handed to the model as a
  // GENERATION reference — the model already laid the design out around it, so
  // overlaying again would double the logo. Only composite in the legacy path.
  if (params.brandLogo && !params.logoReferenceUrl) {
    try {
      console.log(`[Visual] Compositing real brand logo after raw brand generation on ${finalSize.width}x${finalSize.height}`);
      const placement = await resolveLogoPlacement(finalBase64, params);
      finalBase64 = await compositeLogo(
        finalBase64,
        params.brandLogo,
        `${finalSize.width}x${finalSize.height}`,
        placement?.sizePercent || params.logoSizePercent || undefined,
        placement,
      );
    } catch (logoErr) {
      console.error("[Visual] Raw brand logo compositing failed:", logoErr);
    }
  }

  return {
    imageUrl: `data:image/png;base64,${finalBase64}`,
    pipeline: "direct" as const,
    model,
    promptUsed,
  };
}

async function runDirectPipeline(params: PipelineParams) {
  // ── Edit mode: modify an existing design ──
  if (params.editImageUrl) {
    return runEditPipeline(params);
  }

  const {
    prompt, category, width, height, style,
    brandColors, heroType, textMode,
    brandName, contactInfo,
    showBrandName = true, showSocialIcons, socialHandles,
    provider,
  } = params;

  const styleDesc = getPhotoStyleDirection(style || "modern");

  // Describe the format/dimensions to the AI
  const ratio = width / height;
  let formatDesc: string;
  if (ratio > 1.7) {
    formatDesc = `a WIDE HORIZONTAL BANNER (~${ratio.toFixed(1)}:1 ratio). This is a landscape banner — arrange content horizontally with ample width`;
  } else if (ratio > 1.2) {
    formatDesc = `a LANDSCAPE rectangle (~${ratio.toFixed(1)}:1 ratio). Slightly wider than tall — balance content across the width`;
  } else if (ratio > 0.85) {
    formatDesc = `a SQUARE format. Equal width and height — center the composition`;
  } else if (ratio > 0.6) {
    formatDesc = `a PORTRAIT rectangle. Taller than wide — stack content vertically`;
  } else {
    formatDesc = `a TALL VERTICAL format (~1:${(1 / ratio).toFixed(1)} ratio). Very tall and narrow — use strong vertical layout`;
  }

  // Build the comprehensive prompt
  let designPrompt = `Create a professional ${category.replace("_", " ")} design for ${formatDesc}.

CRITICAL — OUTPUT FORMAT:
- The generated image IS the final design itself — it must fill the ENTIRE canvas edge-to-edge
- Do NOT render the design inside a phone screen, browser window, mockup frame, or any other container
- Do NOT place the design on a desk, table, or any surface as if it were a printed piece
- Do NOT add any border, shadow, or margin around the design — the design goes right to every edge
- The image you generate is the ACTUAL deliverable, not a preview or presentation of it

VISUAL STYLE: ${style || "modern"} — ${styleDesc}

LAYOUT — designed for ${formatDesc}:
- Professional ${category.replace("_", " ")} layout filling the entire canvas
- Clean background (soft gradient or subtle texture) extending to all edges
- Text content on the LEFT side (40–50% of width)
- USE THE FULL CANVAS — the design must bleed to every edge with no margin or frame
- VERTICAL DISTRIBUTION: Spread content across the FULL height of the canvas. The headline should start in the upper third (not pushed to the middle). The CTA button should sit in the lower third. Use the entire vertical space — do NOT leave a big empty gap at the top or cluster everything in the center.

TYPOGRAPHY & TEXT STYLING (VERY IMPORTANT — make the text look stunning):
- HEADLINE: Extra-bold/black weight, large font size that commands attention. Use tight letter-spacing and strong line-height. Can use ALL CAPS or Title Case for impact. Position it HIGH on the canvas — near the top, not floating in the middle.
- SUBTITLE: Medium weight, noticeably smaller than headline. Place it WELL BELOW the headline with generous vertical gap between them (at least 2–3x the line height). Slightly muted color or lighter shade for visual hierarchy. The subtitle must NOT touch or crowd the headline — give clear separation.
${params.ctaText ? `- CTA BUTTON: Rounded or pill-shaped button with bold contrasting color. Text inside should be uppercase, semi-bold, with letter-spacing. Add a subtle shadow or glow to make it pop. Place it further below the subtitle with clear spacing.` : "- NO CTA BUTTON: Do NOT include any call-to-action button, \"Learn More\", \"Shop Now\", \"Get Started\", or similar button element."}
- SPACING HIERARCHY: headline → (large gap) → subtitle${params.ctaText ? " → (medium gap) → CTA button" : ""}. Each element must have distinct breathing room. Never stack text elements tightly together.
- Ensure strong contrast between text and background — if the background is busy, add a semi-transparent overlay, gradient fade, or text shadow behind the text area so every word is crisp and readable.
- Use consistent alignment (left-align or center-align all text elements together, never mix).
- Text should NEVER overlap the hero image awkwardly — keep text in its own clear zone with breathing room.
- All text must be pixel-perfect: no cut-off letters, no words bleeding off the edge, no overlapping lines.`;

  // Hero type
  if (heroType === "people") {
    // Gemini/Imagen safety filters block "photorealistic human" language — use softer wording
    const personDesc = provider === "gemini"
      ? `Include a person on the RIGHT side of the design.
- 3/4 body or full body view, standing upright, friendly and professional
- Position them so their feet reach the bottom of the canvas, head visible at top with some space above
- The person should fill the right 50-60% of the design and be the main visual focus
- Clothing and appearance appropriate to the design context`
      : `A REAL HUMAN PERSON (MANDATORY) on the RIGHT side of the design — this is the #1 requirement.
- There MUST be a person — do NOT replace with shapes, patterns, or typography
- 3/4 body or full body shot, standing pose, confident and approachable expression
- Feet anchored to the bottom edge of the canvas, head fully visible with headroom above
- The person should DOMINATE the right 50-60% of the design — they are the main visual focus
- Professional appearance appropriate to the design context (business, casual, etc.)`;
    designPrompt += `\n\nHERO VISUAL: ${personDesc}`;
  } else if (heroType === "product") {
    designPrompt += `\n\nHERO VISUAL: A photorealistic product/device on the RIGHT side.
- Well-lit, clean product photography
- Complete product fully visible, centered on the right half
- Professional studio lighting`;
  } else {
    designPrompt += `\n\nHERO VISUAL: Typography-focused — no person or product.
- Use bold, impactful text as the main visual element
- Geometric shapes, patterns, or decorative elements for visual interest`;
  }

  // Brand identity — logo is composited on top after generation, AI doesn't need to reserve space.
  // Fetch the recipe here so the BRAND rules and the appended art-direction agree.
  const hasLogo = !!params.brandLogo;
  const recipe = await getRecipeConfig();
  designPrompt += `\n\nBRAND:`;
  if (hasLogo) {
    designPrompt += `\n- REAL LOGO LOCK: The user's real brand logo is supplied separately and FlowSmartly composites it after generation exactly once. Do NOT draw, approximate, invent, stylize, or copy any logo, icon mark, seal, monogram, badge, mascot, wordmark, or fake brand emblem anywhere in the design. Do NOT keep or copy a logo from a selected template image. Do NOT create a visible blank logo area, white rectangle, dashed placeholder, label, watermark, frame, or logo-space indicator; keep the underlying design natural.`;
    // With the single-logo recipe on, the model must draw NO brand-name lettering
    // either (the real logo — which usually carries the name — is composited on).
    // Emitting a "brand name may appear as text" hint here is exactly what caused
    // the DUPLICATE wordmark + logo. Only allow it when the recipe is off.
    if (!recipe.singleLogo && showBrandName && brandName) {
      const logoHasName = await logoContainsBrandName(params.brandLogo!, brandName);
      if (!logoHasName) {
        designPrompt += `\n- Brand name text: "${brandName}" may appear as plain readable text only if needed; do not pair it with an invented symbol or fake logo mark.`;
      }
    }
  } else if (showBrandName && brandName) {
    designPrompt += `\n- Brand name: "${brandName}" — display prominently as text only. Do not invent a logo mark, seal, monogram, or emblem.`;
  }

  // Social media handles — explicit bottom-left positioning
  if (showSocialIcons && socialHandles && Object.keys(socialHandles).length > 0) {
    const handlesList = Object.entries(socialHandles)
      .map(([platform, handle]) => `${platform === "twitter" ? "X" : platform}: @${handle}`)
      .join(", ");
    designPrompt += `\n\nSOCIAL MEDIA HANDLES — EXACT PLACEMENT:
${handlesList}
- Position: BOTTOM-LEFT corner of the design, aligned horizontally in a single row
- Place them at the very bottom edge of the canvas with a small margin (about 3-5% from the bottom and left edges)
- Each handle: small recognizable platform icon (Instagram, X/Twitter, Facebook, TikTok, etc.) followed by the @handle text
- Size: Small — roughly 2-3% of the canvas height. Do NOT make them large or prominent
- Style: White or light-colored text if on a dark background, dark text if on a light background — must be readable but subtle
- Spacing: Even horizontal spacing between each handle, all aligned on the same baseline
- Do NOT scatter them vertically or place them in different parts of the design — they must be together in one row at the bottom-left`;
  }
  if (brandColors) {
    const colorParts = [];
    if (brandColors.primary) colorParts.push(`primary color is ${brandColors.primary}`);
    if (brandColors.secondary) colorParts.push(`secondary color is ${brandColors.secondary}`);
    if (brandColors.accent) colorParts.push(`accent color is ${brandColors.accent}`);
    if (colorParts.length > 0) {
      designPrompt += `\n- Brand colors: The ${colorParts.join(", ")}. Apply these colors visually to the CTA button, accents, and decorative elements. IMPORTANT: Do NOT write any hex color codes, color values, or color names as visible text anywhere on the design — just USE the colors visually.`;
    }
  }

  // Text mode — CTA only when user explicitly provides one
  const ctaInstruction = params.ctaText
    ? `\nCTA BUTTON: Use this EXACT call-to-action text on a CTA button: "${params.ctaText}". Style it as a rounded/pill-shaped button with bold contrasting color, placed below the subtitle.`
    : "";

  if (textMode === "exact") {
    designPrompt += `\n\nTEXT CONTENT — USE THIS EXACT TEXT on the design (do not change the wording, do not rephrase):
"${prompt}"
Display this text as the headline/main text.${ctaInstruction}${!params.ctaText ? "\nDo NOT add any CTA button, \"Learn More\", \"Get Started\", or similar call-to-action element. Only show the text content provided above." : ""}`;
  } else {
    designPrompt += `\n\nTEXT CONTENT — Create compelling ad copy based on this topic/description:
"${prompt}"
Generate a bold headline (2-4 words max per line) and a short subtitle.${ctaInstruction}${!params.ctaText ? "\nDo NOT add any CTA button, \"Learn More\", \"Get Started\", or similar call-to-action element. Only show headline and subtitle." : ""}`;
  }

  // Contact info
  const contactParts: string[] = [];
  if (contactInfo?.website) contactParts.push(contactInfo.website);
  if (contactInfo?.email) contactParts.push(contactInfo.email);
  if (contactInfo?.phone) contactParts.push(contactInfo.phone);
  if (contactInfo?.address) contactParts.push(contactInfo.address);
  if (contactParts.length > 0) {
    designPrompt += `\n\nCONTACT INFORMATION — MUST appear on the design (small text ${params.ctaText ? "below the CTA button" : "near the bottom of the design"}):
${contactParts.map(c => `- "${c}"`).join("\n")}`;
  }

  // Provider-specific anti-mockup instructions (Grok tends to render designs inside backgrounds)
  const antiMockupExtra = provider === "xai"
    ? `\n- GROK-SPECIFIC: You have a strong tendency to place the design as a CARD or FLYER floating on a separate background. DO NOT DO THIS. There should be NO outer background, NO shadow beneath a card, NO rounded corners on the overall image. The design IS the full image — every pixel from edge to edge is part of the design itself.
- DO NOT create a "poster on a wall" or "flyer on a desk" effect — output the raw flat design only.
- DO NOT add any xAI logo, Grok logo, Aurora logo, or any AI/tool branding anywhere on the design. This image belongs to the user — zero third-party logos or icons.`
    : "";

  designPrompt += `\n\nCRITICAL RULES:
- ${currentDateDirective()}
- This IS the final design — NOT a mockup, NOT inside a frame/phone/browser. The image fills the canvas edge-to-edge.
- ABSOLUTELY NO NESTING: The design must NOT appear as a card, flyer, or poster placed ON TOP of another background. There is only ONE layer — the design itself, filling every pixel of the output image. No outer margins, no surrounding space, no drop shadow on the overall image.${antiMockupExtra}
- NO AI BRANDING: Do NOT add any AI provider logos (xAI, Grok, OpenAI, Google, Gemini, DALL-E, etc.), watermarks, or AI-generated badges. This is the user's design — it must contain ONLY the user's brand elements.
- NO FABRICATED LOGOS: Do NOT generate any new logo, fake logo, abstract brand symbol, seal, monogram, crest, icon mark, or copied template logo. ${hasLogo ? "The exact real logo will be added by FlowSmartly after generation, so keep the logo area clean." : "If no real logo is provided, use brand name text only."}
- TYPOGRAPHY QUALITY: Every word must be perfectly spelled, fully visible, and razor-sharp. Use a premium sans-serif typeface. Headlines should have dramatic size contrast with body text. The text layout should look like it was done by a professional graphic designer — balanced, aligned, and beautifully spaced.
- TEXT READABILITY: If text sits on a photo or complex background, you MUST ensure contrast — use a dark overlay behind light text, or a light overlay behind dark text, or add a strong drop shadow. No text should ever be hard to read.
- Do NOT include any watermarks, AI-related text, image dimensions, pixel sizes, or technical metadata on the design
- Do NOT render the design on a background or inside any container — the design IS the full image
- The design must bleed to all 4 edges with no margin, border, or shadow around it`;

  // Append the centralized, Control-Hub-tunable ART-DIRECTION RECIPE — the proven
  // quality layer that lifts every provider to the agency-grade bar (full-bleed +
  // premium polish + exact copy) and enforces a SINGLE real logo (model draws none;
  // the real logo is composited once below). Uses the `recipe` fetched above.
  designPrompt += `\n\n${buildArtDirection({ recipe, hasLogo })}`;

  // ── Resolve reference image (if any) ──

  const refUrl = params.referenceImageUrl || params.templateImageUrl;
  let refBuffer: Buffer | null = null;
  if (refUrl) {
    refBuffer = await resolveImageToBuffer(refUrl);
  }

  // ── ENGINE ROUTING ───────────────────────────────────────────────
  // When a USER REFERENCE IMAGE is supplied (referenceImageUrl):
  //   We use the HYBRID COMPOSITE path so the user's REAL photo ends
  //   up in the result (not a gpt-image-1 regeneration). Steps:
  //     1) gpt-image-1.generate creates a designed background ONLY,
  //        with the right zone left clean (bgOnlyPrompt enforces this).
  //     2) rembg strips the user's photo background → clean cutout.
  //     3) sharp composites the cutout into the right zone with a soft
  //        drop shadow so it grounds naturally instead of "floating".
  //   Result: polished design with the user's actual photo, pixel-exact.
  //
  // When a TEMPLATE REFERENCE is supplied (templateImageUrl, no userRef):
  //   We use gpt-image-1.edit so the model recreates the design in the
  //   template's style. Templates aren't meant to be pixel-preserved.
  //
  // No reference at all:
  //   Standard text-to-image via gpt-image-1.generate.
  // ────────────────────────────────────────────────────────────────

  const useHybridComposite = false;
  const useTemplateEdit = !!refBuffer;

  const templateRefPrompt = useTemplateEdit
    ? `IMPORTANT: Use the provided image as a DESIGN TEMPLATE REFERENCE. Recreate a very similar design following the same layout, composition, visual style, color scheme, and arrangement of elements — but customize it with the specific content, branding, and details described below.\n\n${designPrompt}`
    : null;

  const bgOnlyPrompt = useHybridComposite
    ? `${designPrompt}

You are a SENIOR PRINT DESIGNER producing a polished, magazine-quality ${params.category}. A real photograph will be composited into the right zone afterwards — your job is everything else, and that everything else must look like premium agency work, not a default template.

═══ LAYOUT ZONES (HARD RULES) ═══

RESERVED PHOTO ZONE — the right 50% of the canvas:
- NO text, NO words, NO letters.
- NO icons, NO logos, NO graphics.
- NO patterns, NO ornaments, NO decorative shapes.
- ONLY a soft gradient, single solid colour, or one very subtle abstract curve / colour block.
- Lighting / colour temperature should be slightly cooler-neutral so a composited portrait blends naturally.

TEXT ZONE — the left 45%:
- ALL text lives here. NEVER let a letter cross the horizontal midpoint.
- Use the EXACT words from the brief — do NOT invent headlines, scripture, names, addresses.

═══ DESIGN-QUALITY BAR (this is what separates good from default) ═══

1. TYPOGRAPHIC HIERARCHY — three clearly different sizes:
   - Headline: huge, tight letter-spacing, dramatic. The visual anchor.
   - Subhead / date / time: medium, sits below the headline with breathing room.
   - Contact lines / brand line: small but crisp, never cramped.
   The size jump from headline to body must be at least 3×.

2. CONTACT INFO IS A STYLED SECTION, NOT A LIST OF DUMPED LINES:
   - Add a SUBTLE divider rule (1-2px, accent-coloured) above the contact block to separate it from the body.
   - Render an ICON next to each piece of contact info: a thin location pin next to the address, a phone glyph next to the phone number, a globe next to the website, an envelope next to email. The icons should be hairline, brand-coloured, sized ~70% of the line height. They make the info scannable instead of dumped.
   - If there are multiple contact lines, separate them with subtle vertical rules or generous spacing — never run them together as one wall of text.

3. CALL TO ACTION (or featured line):
   - Wrap the most important short phrase (date+time, "Join Us", scripture, etc.) in a styled treatment — a pill button, a left-border accent rule, an underline with a serif flourish, or a small colour block. It should pop relative to the body text without competing with the headline.

4. DECORATIVE ACCENTS (mandatory unless space genuinely doesn't allow):
   - Add at least ONE intentional accent: a thin gold/brand-colour rule under the headline, a tiny ornamental dot pattern in the corner, a soft geometric shape echoing the photo zone, a subtle texture overlay on the background. Tasteful, not loud. Print designers always add at least one.

5. BRAND MARK PLACEMENT:
   - The brand name / wordmark should sit either as a small confident header at the top of the text zone, or anchored to the bottom-left corner. NOT crammed inline with the contact info.

6. NEGATIVE SPACE:
   - Margins of at least 5% on all four edges. Nothing should crowd the canvas edges.
   - Generous space between the headline block and the supporting copy. Resist filling every pixel.
   - RESERVE one of the two TOP corners as clear, low-detail space (sky, soft gradient, plain wall, or empty background — roughly 22% of the width and ~18% of the height) with NO text and no critical subject in it. The user's real brand logo is overlaid in that reserved corner AFTER generation, so it must never end up on top of any text or the focal subject. Keep headline and body text clear of at least one top corner.

7. COLOUR DISCIPLINE:
   - Use the user's brand palette (or the picked palette) — primary as the dominant hue, accent for the small details (icons, dividers, CTA), neutral for body text. Maximum 3 colours total + white/black for text contrast.
   - Every word must pass WCAG AA contrast against its immediate background.

8. ALIGNMENT:
   - Left-align the text block to a consistent margin. Do NOT centre-align loose lines — they look amateur. Headline, subhead, contact info, and brand mark should all align to the same vertical guide.

═══ FINISH ═══

- NO PLACEHOLDER OUTLINES (rectangular dashed boxes saying "photo goes here").
- EDGE-TO-EDGE — fills all four canvas edges, no nested card-on-background.
- NO AI watermarks, no provider logos, no model branding.

Output a polished, print-ready ${params.category} background. The photo will be added afterwards by the system.`
    : null;

  // ── Generate image via selected provider ──

  let base64: string | null;
  let model: string;

  // bg-only when user ref → composite later; template edit when no userRef; raw text-to-image otherwise.
  const generationPrompt = bgOnlyPrompt || templateRefPrompt || designPrompt;
  const useEditApi = useTemplateEdit;

  if (!useEditApi) {
    const generated = await generateImageForRole(
      imageGenerateRole(params.tier),
      generationPrompt,
      width,
      height,
      { quality: "high" },
    );
    base64 = generated.base64;
    model = generated.model;
  } else {
    // Template/reference edit — recreate the design in the template's style via
    // the role-aware edit chain (global model policy picks the provider+model).
    const edited = await editImagesForRole(
      imageEditRole(params.tier),
      templateRefPrompt!,
      [refBuffer!],
      width,
      height,
      { quality: "high", intent: "exact" },
    );
    base64 = edited.base64;
    model = edited.model;
  }

  if (!base64) {
    throw new Error("Failed to generate design image. Please try again.");
  }

  // ── Get actual image dimensions for logo compositing ──

  let finalBase64 = base64;
  let finalW = width;
  let finalH = height;

  try {
    const meta = await sharp(Buffer.from(base64, "base64")).metadata();
    finalW = meta.width || width;
    finalH = meta.height || height;
    console.log(`[Visual] Generated image: ${finalW}x${finalH} (target was ${width}x${height})`);
  } catch {
    console.warn("[Visual] Could not read image metadata, using target dimensions");
  }

  // ── HYBRID COMPOSITE: drop the user's REAL photo onto the bg-only design ──
  // Runs only when useHybridComposite (referenceImageUrl was provided).
  // The model produced a clean right-side photo zone; we now place the
  // user's actual photograph (rembg cutout + soft drop shadow) into it.
  if (useHybridComposite && refBuffer) {
    try {
      const cutoutBuffer = await stripReferenceBg(refBuffer);
      const useCutout = !!cutoutBuffer;
      const subjectSrc = cutoutBuffer ?? refBuffer;
      console.log(`[Visual] Hybrid composite: rembg ${useCutout ? "ok" : "skipped"}; placing user's real photo`);

      const bgBuffer = Buffer.from(finalBase64, "base64");
      const bgMeta = await sharp(bgBuffer).metadata();
      const bgW = bgMeta.width || finalW;
      const bgH = bgMeta.height || finalH;

      // Subject takes ~45% of width / 85% of height when cut out cleanly,
      // smaller when raw rectangle (so the visible edge is less obvious).
      const widthFraction = useCutout ? 0.46 : 0.36;
      const heightFraction = useCutout ? 0.88 : 0.72;
      const subjectW = Math.round(bgW * widthFraction);
      const subjectH = Math.round(bgH * heightFraction);
      let resizedSubject = await sharp(subjectSrc)
        // Tiny saturation + contrast bump so the cutout pops against the
        // generated background instead of looking flat. Same treatment a
        // print designer would apply to a portrait before placing it.
        .modulate({ saturation: 1.08, brightness: 1.02 })
        .resize(subjectW, subjectH, { fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer();

      // Soft drop shadow synthesised from the cutout's alpha — grounds
      // the subject so it doesn't float over the bg like a sticker.
      if (useCutout) {
        try {
          const subMeta0 = await sharp(resizedSubject).metadata();
          const sw = subMeta0.width || subjectW;
          const sh = subMeta0.height || subjectH;
          const alphaShadow = await sharp(resizedSubject)
            .extractChannel("alpha")
            .blur(20)
            .toColourspace("b-w")
            .toBuffer();
          const shadowLayer = await sharp({
            create: { width: sw, height: sh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
          })
            .composite([{ input: alphaShadow, blend: "dest-in" }])
            .ensureAlpha()
            .png()
            .toBuffer();
          const dimmedShadow = await sharp(shadowLayer)
            .composite([{
              input: Buffer.from([0, 0, 0, Math.round(255 * 0.32)]),
              raw: { width: 1, height: 1, channels: 4 },
              tile: true,
              blend: "dest-in",
            }])
            .png()
            .toBuffer();
          resizedSubject = await sharp({
            create: { width: sw + 30, height: sh + 30, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
          })
            .composite([
              { input: dimmedShadow, left: 15, top: 22 },
              { input: resizedSubject, left: 0, top: 0 },
            ])
            .png()
            .toBuffer();
        } catch (shadowErr) {
          console.warn("[Visual] drop shadow synthesis failed (continuing):", shadowErr);
        }
      }

      const subMeta = await sharp(resizedSubject).metadata();
      const actualW = subMeta.width || subjectW;
      const actualH = subMeta.height || subjectH;

      // Anchor in the right zone: feet to bottom edge with small breathing
      // room. With cutouts we go to the literal right edge; with raw
      // rectangles we leave a small gap so the edge is less obvious.
      const rightInset = useCutout ? 0.50 : 0.58;
      const bottomInset = useCutout ? 0.0 : 0.04;
      const left = Math.round(bgW * rightInset);
      const top = Math.round(bgH - actualH - bgH * bottomInset);

      const composited = await sharp(bgBuffer)
        .composite([{
          input: resizedSubject,
          left: Math.min(left, bgW - actualW),
          top: Math.max(0, top),
        }])
        .png()
        .toBuffer();

      finalBase64 = composited.toString("base64");
      // Refresh dimensions in case sharp normalised anything.
      const finalMeta = await sharp(composited).metadata();
      finalW = finalMeta.width || finalW;
      finalH = finalMeta.height || finalH;
    } catch (compErr) {
      console.error("[Visual] Hybrid composite failed (using bg-only image):", compErr);
    }
  }

  // ── Auto-trim white/light borders AI models often add ──
  try {
    finalBase64 = await trimWhiteBorder(finalBase64);
    // Re-read dimensions in case trim changed them
    const trimMeta = await sharp(Buffer.from(finalBase64, "base64")).metadata();
    if (trimMeta.width && trimMeta.height) {
      finalW = trimMeta.width;
      finalH = trimMeta.height;
    }
  } catch (trimErr) {
    console.warn("[Visual] Auto-trim failed, using original:", trimErr);
  }

  // ── Composite brand logo (top-left, TOP layer) ──

  if (hasLogo && params.brandLogo) {
    try {
      console.log(`[Visual] Compositing logo on ${finalW}x${finalH} canvas...`);
      const placement = await resolveLogoPlacement(finalBase64, params);
      finalBase64 = await compositeLogo(
        finalBase64,
        params.brandLogo,
        `${finalW}x${finalH}`,
        placement?.sizePercent || params.logoSizePercent || undefined,
        placement,
      );
      console.log("[Visual] Logo composited successfully");
    } catch (logoErr) {
      console.error("[Visual] Logo compositing failed:", logoErr);
    }
  }

  return {
    imageUrl: `data:image/png;base64,${finalBase64}`,
    pipeline: "direct" as const,
    model,
    promptUsed: designPrompt,
  };
}

// ═══════════════════════════════════════════════════════════════
// EDIT PIPELINE — modify an existing design with user instructions
// ═══════════════════════════════════════════════════════════════

async function runEditPipeline(params: PipelineParams) {
  const {
    prompt,
    width,
    height,
    provider,
    editImageUrl,
    editRegion,
    editIntent = "auto",
    editReferenceMode = "adapt",
    editReferenceImageUrls = [],
  } = params;
  const referenceUrls = editReferenceImageUrls.filter(Boolean).slice(0, 4);
  const resolvedEditIntent = inferEditIntent(prompt, editIntent);
  const hasReferenceImages = referenceUrls.length > 0;
  const isBackgroundReplacement = hasReferenceImages && isBackgroundReplacementIntent(prompt);
  const hasReplacementRefs = resolvedEditIntent === "replace_subject" && hasReferenceImages && !isBackgroundReplacement;
  const mustUseEveryReplacementRef = hasReplacementRefs && shouldUseEveryReplacementReference(prompt, referenceUrls.length);
  const effectiveEditReferenceMode = hasReplacementRefs
    ? editReferenceMode === "keep_face" || shouldLockFaceButAllowStyling(prompt) ? "keep_face" : "exact"
    : editReferenceMode;

  console.log(`[Visual/Edit] Provider: ${provider}, intent: ${resolvedEditIntent}, refMode: ${effectiveEditReferenceMode}, refs: ${referenceUrls.length}, useAllRefs=${mustUseEveryReplacementRef}, instruction: "${prompt.slice(0, 80)}"`);

  // Optional pinpoint-region clause. Image-edit providers (xAI grok-imagine-image,
  // Gemini, OpenAI gpt-image-1) accept a single edit instruction string, so we
  // inject the bounds verbally as a percent-of-canvas rectangle. Percent is
  // more robust than pixel coords because providers may rescale internally.
  let regionClause = "";
  if (editRegion && editRegion.canvasW > 0 && editRegion.canvasH > 0) {
    const xPct = Math.max(0, Math.min(100, (editRegion.x / editRegion.canvasW) * 100));
    const yPct = Math.max(0, Math.min(100, (editRegion.y / editRegion.canvasH) * 100));
    const wPct = Math.max(0, Math.min(100, (editRegion.w / editRegion.canvasW) * 100));
    const hPct = Math.max(0, Math.min(100, (editRegion.h / editRegion.canvasH) * 100));
    const xRight = Math.min(100, xPct + wPct);
    const yBottom = Math.min(100, yPct + hPct);
    regionClause = `

PINPOINT REGION — APPLY THE EDIT ONLY INSIDE THIS BOX:
- Top-left corner: ${xPct.toFixed(1)}% from left, ${yPct.toFixed(1)}% from top
- Bottom-right corner: ${xRight.toFixed(1)}% from left, ${yBottom.toFixed(1)}% from top
- Box size: ${wPct.toFixed(1)}% wide × ${hPct.toFixed(1)}% tall (relative to the full canvas)
- DO NOT modify pixels outside this box. Everything outside the box must stay byte-for-byte the same.
- The edit must blend seamlessly with the surrounding pixels at the box border (no visible seam).`;
    console.log(`[Visual/Edit] Region: (${xPct.toFixed(1)}%, ${yPct.toFixed(1)}%) ${wPct.toFixed(1)}%×${hPct.toFixed(1)}%`);
  }

  const referenceLabel = referenceUrls.length > 1
    ? `Images 2 through ${referenceUrls.length + 1} are ${referenceUrls.length} separate replacement reference images.`
    : "Image 2 is the replacement reference image.";
  const faceIdentityLockClause = hasReferenceImages
    ? `
FACE IDENTITY LOCK FOR ANY HUMAN REFERENCE:
- If any reference image contains a human face, that real person's facial identity is non-negotiable.
- Preserve the actual face from the uploaded reference: facial geometry, eyes, nose, mouth, jawline, cheeks, skin tone, age, hairline/hair shape, expression, and recognizable identity.
- Do NOT synthesize a lookalike, similar person, younger/older version, alternate face, stock person, or AI-generated replacement.
- If the user asks to change clothes, outfit, pose, background, lighting, or place the person into a new design, change only those requested non-face elements. The face/head identity must still read as the same real person from the reference.
- The source photo's background is NOT locked. Remove, repaint, blur, extend, or adapt the uploaded photo background as needed so the real person sits naturally in the target design.
- Do not bring unwanted room walls, chairs, harsh crops, random people, or snapshot clutter from the reference unless the user explicitly asks to keep that background.
- Treat the reference photo as identity evidence, not visual inspiration.`
    : "";
  const multiReplacementReferenceRules = mustUseEveryReplacementRef
    ? `
MULTI-PHOTO REPLACEMENT REQUIREMENT:
- Use EVERY replacement reference image exactly once. Do not ignore any provided reference.
- Replace the current/generated photo or image slots with the provided references in natural reading order: left-to-right, then top-to-bottom.
- Use the existing photo slots in the original design. Do not create new cards, extra frames, sticker stacks, or a new collage unless the user's prompt explicitly asks for that.
- Do not cover, blur, crop away, or overlap any text, logo, QR code, contact detail, icon, or border.
- Do not create stock people, generic substitute portraits, or blended lookalikes. The visible people/photos must come from the provided reference images.
- Preserve the source design's text, date, logo, address, email, website, social handles, colors, and layout exactly. Do not rewrite or re-typeset copy.`
    : "";
  const replacementReferenceModeRules =
    effectiveEditReferenceMode === "exact"
      ? `REFERENCE LOCK MODE: EXACT SOURCE
- Treat the replacement reference as the literal source photo/object, not inspiration.
- Do not invent a similar person/object. For people, the face and identity must remain the real uploaded person, not a generated lookalike. Do not change facial geometry, skin tone, hairline, expression, or recognizable identity.
- Do not change the reference subject's body proportions, clothing, product shape, logos, markings, or distinctive details unless the user explicitly asks.
- Only adapt scale, crop, perspective, lighting, shadows, edge blending, and color grade so the exact reference subject fits naturally into the current design.`
      : effectiveEditReferenceMode === "keep_face"
        ? `REFERENCE LOCK MODE: KEEP FACE
- Preserve the reference person's real face, facial geometry, eyes, nose, mouth, jawline, skin tone, age, expression, head angle, hair, and recognizable identity.
- Clothing, outfit, accessories below the neck, and body styling may change to satisfy the instruction.
- If the user's clothing or styling instruction conflicts with preserving the face or identity, preserve the face and identity first.`
        : `REFERENCE MODE: ADAPT
- Use the replacement reference image as the visual source for the new person/object.
- Preserve recognizable visual details where possible while adapting the subject to the design.`;
  const replacementReferenceClause = hasReplacementRefs
    ? `

REFERENCE IMAGE INPUTS:
- Image 1 is the current design canvas.
- ${referenceLabel}
${faceIdentityLockClause}
${replacementReferenceModeRules}${multiReplacementReferenceRules}`
    : "";
  const editReferenceClause = hasReferenceImages && !hasReplacementRefs
    ? `

REFERENCE IMAGE INPUTS:
- Image 1 is the current design canvas.
- Images 2 through ${referenceUrls.length + 1} are user reference media.
- Interpret the references from the user's prompt. They may be style examples, product/person assets, visual direction, brand examples, or before/after targets.
- Do not simply paste a reference on top of the canvas. If the prompt asks to insert, replace, or use a referenced asset, remove or repaint the conflicting old element first, then integrate the reference naturally with matching lighting, perspective, scale, shadows, and color.
${faceIdentityLockClause}`
    : "";
  const replacementModeRuleClause =
    hasReplacementRefs && effectiveEditReferenceMode === "exact"
      ? "\n- The reference subject must remain visually identical except for necessary integration adjustments."
      : hasReplacementRefs && effectiveEditReferenceMode === "keep_face"
        ? "\n- The reference face and identity must remain unchanged while clothing/body styling can follow the prompt."
        : "";

  const editPrompt = isBackgroundReplacement
    ? `You are editing an existing graphic design image. Replace only the background/backdrop requested by the user while preserving the foreground design exactly.

BACKGROUND REPLACEMENT INSTRUCTION: ${prompt}${editReferenceClause}${regionClause}

BACKGROUND RULES:
- Image 1 is the current design canvas. Images 2 through ${referenceUrls.length + 1} are the user's background/reference media.
- Use the provided reference media as the actual visual source for the new background/backdrop. Do not invent a different scene when a reference is supplied.
- Remove or repaint only the current background/backdrop pixels needed to satisfy the instruction.
- Preserve all foreground subjects, text, logos, QR codes, icons, borders, contact details, product photos, and layout exactly as-is.
- Keep the same dimensions and aspect ratio.
- The result must look like a clean professional edit, not a pasted overlay.`
    : resolvedEditIntent === "replace_subject"
    ? `You are editing an existing graphic design image. Replace the requested person/object/photo area while keeping the rest of the design exactly the same - same layout, same colors, same style, same background, same composition.

REPLACEMENT INSTRUCTION: ${prompt}${replacementReferenceClause}${regionClause}

REPLACEMENT RULES:
- Identify the target person/object/photo areas from the instruction. If the target is not named, use the main visible person/object/photo areas in the pinpoint region, or the main visible person/object/photo areas on the canvas when no region is provided.
- Remove the original target cleanly and replace it with the requested new person/object/photo${hasReplacementRefs ? referenceUrls.length > 1 ? "s from the replacement reference images" : " from the replacement reference image" : ""}.
- Match the replacement to the existing design's perspective, lighting, shadows, scale, camera angle, color grade, and graphic style.
- Remove or adapt the uploaded reference photo background as needed. The subject's face identity is locked; the source-photo background is flexible and should be cleaned up to fit the design.
- Preserve every text block, logo, icon, border, ornament, background element, and non-target subject exactly as-is.
- Never change, rewrite, auto-correct, crop away, or blur the existing words/numbers/contact details.
- Do not add duplicate people or duplicate objects. The replacement should occupy the target's place.${replacementModeRuleClause}
- Only modify the replacement target${editRegion ? " and ONLY inside the pinpoint region above" : ""}.
- Maintain the same dimensions and aspect ratio.
- The result must look like a professional design, not a rough edit`
    : `You are editing an existing graphic design image. Apply ONLY the following change and keep everything else exactly the same — same layout, same colors, same style, same background, same composition.

EDIT INSTRUCTION: ${prompt}${editReferenceClause}${regionClause}

RULES:
- Preserve the overall design exactly as-is
- Only modify what the instruction asks for${editRegion ? " — and ONLY inside the pinpoint region above" : ""}
- Keep all other text, images, shapes, and colors unchanged
- Maintain the same dimensions and aspect ratio
- The result must look like a professional design, not a rough edit`;

  // Resolve the existing design image (canvas) to a buffer.
  const editBuffer = await resolveImageToBuffer(editImageUrl!);
  const editReferenceBuffers = hasReferenceImages
    ? await Promise.all(referenceUrls.map((url) => resolveImageToBuffer(url)))
    : [];

  // Logo placement edits: when the instruction is about the LOGO, hand the
  // REAL brand logo to the model as a reference image so it can add/move/remove
  // the actual logo per the instruction. A fixed composite can't follow "put it
  // at the bottom / remove the old one"; the model placing the real pixels can.
  let logoEditClause = "";
  if (/\blogos?\b/i.test(prompt) && params.brandLogo) {
    try {
      const logoBuf = await resolveImageToBuffer(params.brandLogo);
      editReferenceBuffers.push(logoBuf);
      logoEditClause =
        " IMPORTANT LOGO HANDLING: the LAST reference image provided is the brand's REAL logo. When the instruction asks to add, move, reposition, or replace the logo, composite THAT exact logo (use its real pixels — do NOT redraw, recolor, restyle, or invent a logo) at the requested position, and REMOVE any other/old logo already in the design so only this one remains. This overrides any rule about preserving the existing logo as-is.";
    } catch {
      /* logo unavailable — proceed without it */
    }
  }

  // Role-aware edit: the global model policy picks the provider+model ladder
  // (Nano Banana → OpenAI → xAI for standard; gpt-image for premium). Image 1
  // is always the canvas; references follow.
  const editIntentForRole: ImageEditIntent =
    effectiveEditReferenceMode === "keep_face"
      ? "identity"
      : effectiveEditReferenceMode === "exact"
        ? "exact"
        : "creative";
  console.log(`[Visual/Edit] Role edit (tier=${params.tier}, intent=${editIntentForRole}, refs=${editReferenceBuffers.length})`);
  const edited = await editImagesForRole(
    imageEditRole(params.tier),
    editPrompt + logoEditClause,
    [editBuffer, ...editReferenceBuffers],
    width,
    height,
    { quality: "high", intent: editIntentForRole },
  );
  const base64 = edited.base64;
  const model = edited.model;
  const usedProvider = edited.provider;

  if (!base64) {
    throw new Error("Edit returned no image");
  }

  // Skip logo compositing on edits — the logo was already composited on the original
  // image, so the AI edit preserves it. Re-compositing would create a double logo.
  const finalBase64 = base64;
  console.log(`[Visual/Edit] Completed with ${usedProvider}; skipping logo compositing (already present from original generation)`);

  return {
    imageUrl: `data:image/png;base64,${finalBase64}`,
    pipeline: "edit" as const,
    model,
    promptUsed: editPrompt,
  };
}

// ═══════════════════════════════════════════════════════════════
// LOGO COMPOSITING — sharp-based overlay
// ═══════════════════════════════════════════════════════════════

/**
 * Decide WHERE the brand logo goes BEFORE compositing it.
 *
 * If the caller pinned an explicit position (x/y — e.g. from a manual logo
 * editor) we respect it. Otherwise we run the same vision safe-area pass the
 * GBP / automation-media pipelines use (analyzeLogoPlacement): it inspects the
 * finished image and returns a clear TOP corner (left or right) with no text,
 * faces, or subject, so the logo never lands on the headline or body copy.
 * Falls back to the analyzer's own top-right default if vision is unavailable.
 */
async function resolveLogoPlacement(
  imageBase64: string,
  params: PipelineParams,
): Promise<LogoPlacement | undefined> {
  const explicit = params.logoPlacement;
  if (explicit && (explicit.x !== undefined || explicit.y !== undefined)) {
    return explicit;
  }
  try {
    const safe = await analyzeLogoPlacement(Buffer.from(imageBase64, "base64"));
    console.log(
      `[Visual] Safe-area logo placement: corner=${safe.corner} source=${safe.source}${safe.reason ? ` reason="${safe.reason}"` : ""}`,
    );
    return {
      x: safe.x,
      y: safe.y,
      sizePercent: explicit?.sizePercent ?? params.logoSizePercent ?? safe.sizePercent,
    };
  } catch (err) {
    console.warn("[Visual] Safe-area analysis failed; using provided/default placement:", err);
    return explicit ?? undefined;
  }
}

async function compositeLogo(
  imageBase64: string,
  logoSource: string,
  targetSize: string,
  sizePercent?: number,
  placement?: LogoPlacement,
): Promise<string> {
  void targetSize;
  return compositeBrandLogoOnImageBase64({
    imageBase64,
    logoSource,
    placement: {
      x: placement?.x,
      y: placement?.y,
      sizePercent: placement?.sizePercent || sizePercent,
    },
  });


  // Logo size = user-chosen % of image WIDTH (most intuitive for horizontal logos).
  // Default 12%, minimum 30px. No upper pixel cap — respect what the user asked for.
  // Max height = same as max width (prevents extremely tall logos from dominating)
  // Position: flush to top edge (y=0) and 1% from left — sits above all design content

  // Get logo buffer

  // Trim transparent padding

  // Resize logo: fit INSIDE the bounding box preserving aspect ratio — no padding added.
  // "inside" means the logo's actual rendered width/height matches what the user requested,
  // unlike "contain" which pads wide/tall logos into a square (making them look tiny).

  // Composite onto design
}

// ═══════════════════════════════════════════════════════════════
// AUTO-TRIM — Remove white/light borders AI models often add
// ═══════════════════════════════════════════════════════════════

/**
 * Detect and crop white/light-colored borders from AI-generated images.
 * AI models often render designs as "cards" floating on a white background.
 * This scans the edges, finds where the actual design content starts, and crops.
 * Only trims if edges are predominantly light (>85% of edge pixels are near-white).
 */
async function trimWhiteBorder(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const img = sharp(buffer);
  const meta = await img.metadata();
  const w = meta.width!;
  const h = meta.height!;

  // Extract raw pixel data (RGBA)
  const { data } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  // Check if a pixel is "light" (near-white or very light gray)
  const isLight = (x: number, y: number): boolean => {
    const idx = (y * w + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return r > 230 && g > 230 && b > 230;
  };

  // Scan each edge to find how many pixels are light
  const scanThreshold = 0.85; // 85% of edge pixels must be light to count as border

  // Find top border
  let top = 0;
  for (let y = 0; y < Math.floor(h * 0.25); y++) {
    let lightCount = 0;
    for (let x = 0; x < w; x += 2) { // sample every 2nd pixel for speed
      if (isLight(x, y)) lightCount++;
    }
    if (lightCount / Math.ceil(w / 2) >= scanThreshold) {
      top = y + 1;
    } else {
      break;
    }
  }

  // Find bottom border
  let bottom = h;
  for (let y = h - 1; y >= Math.floor(h * 0.75); y--) {
    let lightCount = 0;
    for (let x = 0; x < w; x += 2) {
      if (isLight(x, y)) lightCount++;
    }
    if (lightCount / Math.ceil(w / 2) >= scanThreshold) {
      bottom = y;
    } else {
      break;
    }
  }

  // Find left border
  let left = 0;
  for (let x = 0; x < Math.floor(w * 0.25); x++) {
    let lightCount = 0;
    for (let y = 0; y < h; y += 2) {
      if (isLight(x, y)) lightCount++;
    }
    if (lightCount / Math.ceil(h / 2) >= scanThreshold) {
      left = x + 1;
    } else {
      break;
    }
  }

  // Find right border
  let right = w;
  for (let x = w - 1; x >= Math.floor(w * 0.75); x--) {
    let lightCount = 0;
    for (let y = 0; y < h; y += 2) {
      if (isLight(x, y)) lightCount++;
    }
    if (lightCount / Math.ceil(h / 2) >= scanThreshold) {
      right = x;
    } else {
      break;
    }
  }

  const cropW = right - left;
  const cropH = bottom - top;

  // Only crop if we found a meaningful border (at least 2% on any side)
  const minBorder = Math.min(w, h) * 0.02;
  if (top < minBorder && left < minBorder && (w - right) < minBorder && (h - bottom) < minBorder) {
    console.log("[Visual] No significant border detected, skipping trim");
    return base64;
  }

  if (cropW < w * 0.5 || cropH < h * 0.5) {
    console.log("[Visual] Trim would crop too aggressively, skipping");
    return base64;
  }

  console.log(`[Visual] Trimming border: top=${top} left=${left} right=${w - right} bottom=${h - bottom} → ${cropW}x${cropH}`);

  const trimmed = await sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();

  return trimmed.toString("base64");
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Use Claude vision to check if a brand logo contains the brand name text.
 */
async function logoContainsBrandName(
  logoSource: string,
  brandName: string
): Promise<boolean> {
  try {
    // Convert to data URI if needed
    let logoDataUri: string;
    if (logoSource.startsWith("data:")) {
      logoDataUri = logoSource;
    } else if (logoSource.startsWith("/")) {
      const localPath = path.join(process.cwd(), "public", logoSource);
      const buf = await readFile(localPath);
      logoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
    } else if (logoSource.startsWith("http")) {
      const res = await fetch(logoSource);
      if (!res.ok) return true;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "image/png";
      logoDataUri = `data:${ct.split(";")[0]};base64,${buf.toString("base64")}`;
    } else {
      return true;
    }

    const mediaTypeMatch = logoDataUri.match(/^data:(image\/[^;]+);base64,/);
    if (!mediaTypeMatch) return false;

    const mediaType = mediaTypeMatch[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    const base64Data = logoDataUri.replace(/^data:image\/[^;]+;base64,/, "");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let response;
    try {
      response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: `Does this logo contain the text "${brandName}" (or a very similar spelling)? Answer ONLY "yes" or "no".` },
        ],
      }],
    });
    } catch (primaryErr: unknown) {
      const status = (primaryErr as { status?: number }).status;
      if ((status === 401 || status === 403 || status === 429 || status === 500 || status === 503 || status === 529) && process.env.ANTHROPIC_BACKUP_API_KEY) {
        console.warn("[Visual] Primary Anthropic key failed, using backup");
        const backupClient = new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY });
        response = await backupClient.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          temperature: 0,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
              { type: "text", text: `Does this logo contain the text "${brandName}" (or a very similar spelling)? Answer ONLY "yes" or "no".` },
            ],
          }],
        });
      } else {
        throw primaryErr;
      }
    }

    const answer = response.content[0]?.type === "text" ? response.content[0].text.toLowerCase().trim() : "";
    console.log(`[Visual] Logo name analysis: "${answer}" for brand "${brandName}"`);
    return answer.startsWith("yes");
  } catch (err) {
    console.warn("[Visual] Logo analysis failed, assuming name is present:", err);
    return true;
  }
}

function getPhotoStyleDirection(style: string): string {
  const directions: Record<string, string> = {
    photorealistic: "Ultra-realistic professional photography. Sharp focus, natural lighting, shallow depth of field. Studio or editorial quality.",
    illustration: "Colorful, vibrant scene with saturated colors. Well-lit, clean composition. Fun, energetic mood.",
    minimalist: "Clean, uncluttered composition with lots of negative space. Soft, diffused lighting. Muted, neutral color palette.",
    modern: "Contemporary professional photography. Bold lighting with strong contrasts. Trendy color grading.",
    vintage: "Warm-toned photography with golden hour lighting. Slightly desaturated. Classic film photography feel.",
    abstract: "Artistic composition with unusual angles. Bold color blocking. Macro or experimental photography.",
    flat: "Evenly lit, top-down or straight-on perspective. Bright, solid-colored backgrounds. Clean product-style.",
    "3d": "Dramatic lighting with clear depth. Isometric or perspective angle. Glossy surfaces and reflections.",
    watercolor: "Soft, dreamy photography with gentle lighting. Pastel-toned scenes. Ethereal atmosphere.",
    neon: "Dark scene with neon/LED lighting. Cyberpunk atmosphere. Rich blacks with electric blue, magenta, green accents.",
  };
  return directions[style] || directions.modern;
}
