import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { ai } from "@/lib/ai/client";
import { openaiClient } from "@/lib/ai/openai-client";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { saveDesignImage, saveDesignSvg } from "@/lib/utils/file-storage";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { presignAllUrls } from "@/lib/utils/s3-client";

/**
 * Dual-Mode Visual Generation Pipeline
 *
 * MODE 1 — DIRECT (gpt-image-1 handles everything):
 *   For sizes gpt-image-1 can produce (aspect ratio 0.5–2.0, max dim ≤ 2000).
 *   Single API call → complete design as PNG.
 *
 * MODE 2 — CLAUDE (hybrid pipeline):
 *   For extreme aspect ratios or large print sizes gpt-image-1 can't handle.
 *   Step 1: Claude analyzes → plans images
 *   Step 2: OpenAI generates images in parallel
 *   Step 3: Claude composes SVG with placeholder tokens
 *   Step 4: Replace placeholders with base64 data URIs
 */

// ── Placeholder tokens for Claude pipeline ──
const IMG_PLACEHOLDER_BG = "{{IMG_BACKGROUND}}";
const IMG_PLACEHOLDER_EL = (id: string) => `{{IMG_ELEMENT_${id}}}`;
const IMG_PLACEHOLDER_LOGO = "{{IMG_BRAND_LOGO}}";

interface ElementImage {
  id: string;
  prompt: string;
  role: string;
  suggestedSize: { w: number; h: number };
  suggestedPosition: { x: number; y: number };
}

interface DesignAnalysis {
  backgroundPrompt: string;
  elements: ElementImage[];
  overlayPlan: string;
}

// ── Pipeline mode selection ──

function getPipelineMode(width: number, height: number): "direct" | "claude" {
  const aspectRatio = width / height;
  // Direct mode: any reasonable aspect ratio (0.5–2.0)
  // Large sizes are fine — we upscale after generation
  if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
    return "direct";
  }
  // Claude pipeline only for extreme aspect ratios (banners, skyscrapers, etc.)
  return "claude";
}

function getGptImageSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const aspectRatio = width / height;
  if (aspectRatio > 1.3) return "1536x1024";
  if (aspectRatio < 0.77) return "1024x1536";
  return "1024x1024";
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

    const gate = checkPlanAccess(session.user.plan, "AI visual design");
    if (gate) return gate;

    const body = await request.json();
    const {
      prompt, category, size, style,
      brandColors, heroType, textMode,
      brandLogo, brandName, contactInfo,
      showBrandName, showSocialIcons, socialHandles,
      templateImageUrl,
    } = body;
    // textMode: "exact" | "creative" (default: "creative")
    // showBrandName: boolean (default true) - whether to show brand name text alongside logo
    // showSocialIcons: boolean - whether to include social media handles
    // socialHandles: { instagram?: string, twitter?: string, ... } - social handles to display

    if (!prompt || !category || !size) {
      return NextResponse.json(
        { success: false, error: { message: "Prompt, category, and size are required" } },
        { status: 400 }
      );
    }

    // Check credits (free credits can only be used for email marketing)
    const isAdmin = !!session.adminId;
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_VISUAL_DESIGN", isAdmin);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }
    const creditCost = await getDynamicCreditCost("AI_VISUAL_DESIGN");

    // Create design record
    const design = await prisma.design.create({
      data: {
        userId: session.userId,
        prompt,
        category,
        size,
        style: style || null,
        status: "GENERATING",
        metadata: JSON.stringify({ brandColors: brandColors || null }),
      },
    });

    const [width, height] = size.split("x").map(Number);
    const pipelineMode = getPipelineMode(width, height);
    console.log(`[Visual] Pipeline: ${pipelineMode} for ${width}x${height} (ratio ${(width / height).toFixed(2)})`);

    // ═══════════════════════════════════════════════════════════
    // Route to the appropriate pipeline
    // ═══════════════════════════════════════════════════════════

    let result: {
      imageUrl: string;
      svgContent: string | null;
      pipeline: "direct" | "hybrid" | "svg-only";
      model: string;
      promptUsed: string;
    };

    if (pipelineMode === "direct") {
      result = await runDirectPipeline({
        prompt, category, width, height, style,
        brandColors, heroType, textMode,
        brandLogo, brandName, contactInfo,
        showBrandName, showSocialIcons, socialHandles,
        templateImageUrl,
      });
    } else {
      result = await runClaudePipeline({
        prompt, category, width, height, style,
        brandColors, heroType, textMode,
        brandLogo, brandName, contactInfo,
        showBrandName, showSocialIcons, socialHandles,
      });
    }

    // Save image to disk instead of storing base64 in DB
    const isDirectPng = result.pipeline === "direct";
    const imageFileUrl = await saveDesignImage(
      result.imageUrl,
      design.id,
      isDirectPng ? "png" : "svg"
    );

    // Save raw SVG to disk if available (for SVG download)
    let svgFileUrl: string | null = null;
    if (result.svgContent) {
      svgFileUrl = await saveDesignSvg(result.svgContent, design.id);
    }

    // Update design record with file URL (not base64)
    const updatedDesign = await prisma.design.update({
      where: { id: design.id },
      data: {
        imageUrl: imageFileUrl,
        status: "COMPLETED",
        metadata: JSON.stringify({
          brandColors: brandColors || null,
          pipeline: result.pipeline,
          ...(svgFileUrl ? { svgUrl: svgFileUrl } : {}),
        }),
      },
    });

    // Deduct credits
    const currentUser = !isAdmin
      ? await prisma.user.findUnique({
          where: { id: session.userId },
          select: { aiCredits: true },
        })
      : null;
    if (!isAdmin) {
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
            description: `Visual design generation: ${category}`,
          },
        }),
      ]);
    }

    // Save to Media Library with file path (not base64)
    const fileSize = isDirectPng
      ? Math.round((result.imageUrl.length - result.imageUrl.indexOf(",") - 1) * 0.75)
      : Buffer.byteLength(result.svgContent || "", "utf-8");
    await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: `design-${design.id}.${isDirectPng ? "png" : "svg"}`,
        originalName: `${category} Design.${isDirectPng ? "png" : "svg"}`,
        url: imageFileUrl,
        type: isDirectPng ? "image" : "svg",
        mimeType: isDirectPng ? "image/png" : "image/svg+xml",
        size: fileSize,
        width,
        height,
        tags: JSON.stringify(["design", "ai-generated", category]),
        metadata: JSON.stringify({ designId: design.id, style: style || "modern", pipeline: result.pipeline }),
      },
    });

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "visual_design",
        model: result.model,
        inputTokens: ai.estimateTokens(result.promptUsed),
        outputTokens: 0,
        costCents: 0,
        prompt: prompt.substring(0, 500),
        response: `Pipeline: ${result.pipeline}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        design: {
          id: updatedDesign.id,
          prompt: updatedDesign.prompt,
          category: updatedDesign.category,
          size: updatedDesign.size,
          style: updatedDesign.style,
          imageUrl: imageFileUrl,
          svgContent: result.svgContent,
          pipeline: result.pipeline,
          status: updatedDesign.status,
          createdAt: updatedDesign.createdAt.toISOString(),
        },
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : (currentUser?.aiCredits || 0) - creditCost,
      }),
    });
  } catch (error) {
    console.error("Visual generation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate visual design" } },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// DIRECT PIPELINE — gpt-image-1 generates the complete design
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
}

async function runDirectPipeline(params: PipelineParams) {
  const {
    prompt, category, width, height, style,
    brandColors, heroType, textMode,
    brandName, contactInfo,
    showBrandName = true, showSocialIcons, socialHandles,
  } = params;

  const gptSize = getGptImageSize(width, height);
  const styleDesc = getPhotoStyleDirection(style || "modern");

  // Build the comprehensive prompt
  let designPrompt = `Create a professional ${category.replace("_", " ")} design.

VISUAL STYLE: ${style || "modern"} — ${styleDesc}

LAYOUT:
- Professional social media ad layout
- Clean, minimal background (soft gradient or subtle texture)
- Text content on the LEFT side (40–50% of width)
- Bold headline, subtitle, and a prominent CTA button
- Small floating 3D social media icons as decorative accents
- Engagement notification badges (heart icon + number like "1.2k")
- USE THE FULL CANVAS — no large empty areas`;

  // Hero type
  if (heroType === "people") {
    designPrompt += `\n\nHERO VISUAL: A professional, friendly person on the RIGHT side of the design.
- 3/4 body shot, standing pose, confident and approachable
- Feet anchored to the bottom edge, head fully visible with headroom above
- The person should DOMINATE the right 50-60% of the design`;
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

  // Brand identity
  const hasLogo = !!params.brandLogo;
  designPrompt += `\n\nBRAND:`;
  if (hasLogo) {
    // Logo will be composited on top-left after generation — keep that area naturally clear
    designPrompt += `\n- TOP-LEFT CORNER: Do not place any text, icons, or design elements in the top-left corner area (roughly the first 12% width and 12% height). Just let the background flow naturally through that area — no boxes, no borders, no placeholder.`;

    // Only show brand name if showBrandName is true
    if (showBrandName && brandName) {
      // Use Claude vision to check if logo already contains the brand name
      const logoHasName = await logoContainsBrandName(params.brandLogo!, brandName);
      if (!logoHasName) {
        // Logo is just an icon — tell gpt-image-1 to also display the brand name
        designPrompt += `\n- Brand name: "${brandName}" — display it near the top but NOT in the top-left corner (place it to the right of the top-left area or in the top-center)`;
      }
      // If logo already has the name, skip — no duplicate brand name text needed
    }
  } else if (showBrandName && brandName) {
    designPrompt += `\n- Brand name: "${brandName}" — display prominently in the top-left corner`;
  }

  // Social media handles - size scales with canvas
  if (showSocialIcons && socialHandles && Object.keys(socialHandles).length > 0) {
    const socialIconSize = Math.max(24, Math.min(Math.round(Math.sqrt(width * height) / 30), 60)); // 24-60px based on canvas
    const socialTextSize = Math.max(12, Math.min(Math.round(Math.sqrt(width * height) / 50), 28)); // 12-28px based on canvas
    const handlesList = Object.entries(socialHandles)
      .map(([platform, handle]) => `${platform === "twitter" ? "X" : platform}: @${handle}`)
      .join(", ");
    designPrompt += `\n\nSOCIAL MEDIA — Include these handles with their platform icons at the bottom or near contact info:
${handlesList}
- Icon size: ${socialIconSize}px (scales with design size)
- Handle text size: ${socialTextSize}px
- Display as recognizable platform icons with the @handle text next to each`;
  }
  if (brandColors) {
    const colorParts = [];
    if (brandColors.primary) colorParts.push(`primary: ${brandColors.primary}`);
    if (brandColors.secondary) colorParts.push(`secondary: ${brandColors.secondary}`);
    if (brandColors.accent) colorParts.push(`accent: ${brandColors.accent}`);
    if (colorParts.length > 0) {
      designPrompt += `\n- Brand colors: ${colorParts.join(", ")} — use these for the CTA button, accents, and decorative elements`;
    }
  }

  // Text mode
  if (textMode === "exact") {
    designPrompt += `\n\nTEXT CONTENT — USE THIS EXACT TEXT on the design (do not change the wording, do not rephrase):
"${prompt}"
Display this text as the headline/main text. Add a short CTA button like "Learn More" or "Get Started".`;
  } else {
    designPrompt += `\n\nTEXT CONTENT — Create compelling ad copy based on this topic/description:
"${prompt}"
Generate a bold headline (2-4 words max per line), a short subtitle, and a CTA button text.`;
  }

  // Contact info
  const contactParts: string[] = [];
  if (contactInfo?.website) contactParts.push(contactInfo.website);
  if (contactInfo?.email) contactParts.push(contactInfo.email);
  if (contactInfo?.phone) contactParts.push(contactInfo.phone);
  if (contactInfo?.address) contactParts.push(contactInfo.address);
  if (contactParts.length > 0) {
    designPrompt += `\n\nCONTACT INFORMATION — MUST appear on the design (small text below the CTA):
${contactParts.map(c => `- "${c}"`).join("\n")}`;
  }

  designPrompt += `\n\nCRITICAL RULES:
- This must look like a REAL professional advertisement — polished, modern, print-ready
- All text must be perfectly readable and spelled correctly
- Clean, modern typography (sans-serif)
- Do NOT include any watermarks or AI-related text
- The design should fill the entire canvas with no awkward empty space`;

  console.log(`[Visual] Direct pipeline: gpt-image-1 @ ${gptSize}${params.templateImageUrl ? " (with template reference)" : ""}`);

  let base64: string | null;

  if (params.templateImageUrl) {
    // Template-based generation: read template from public/ and use images.edit()
    const templatePath = path.join(process.cwd(), "public", params.templateImageUrl);
    const templateBuffer = await readFile(templatePath);

    // Prepend template-reference instruction to the prompt
    const templatePrompt = `IMPORTANT: Use the provided image as a DESIGN TEMPLATE REFERENCE. Recreate a very similar design following the same layout, composition, visual style, color scheme, and arrangement of elements — but customize it with the specific content, branding, and details described below.\n\n${designPrompt}`;

    base64 = await openaiClient.editImage(templatePrompt, templateBuffer, {
      size: gptSize,
      quality: "high",
    });
  } else {
    base64 = await openaiClient.generateImage(designPrompt, {
      size: gptSize,
      quality: "high",
    });
  }

  if (!base64) {
    throw new Error("Failed to generate design image. Please try again.");
  }

  // Upscale to target dimensions FIRST (before logo compositing)
  // This ensures the logo stays crisp at the target resolution
  let finalBase64 = base64;
  const [gptW, gptH] = gptSize.split("x").map(Number);
  let finalW = gptW;
  let finalH = gptH;

  if (width > gptW || height > gptH) {
    try {
      const inputBuffer = Buffer.from(finalBase64, "base64");
      const upscaled = await sharp(inputBuffer)
        .resize(width, height, {
          fit: "fill",
          kernel: sharp.kernel.lanczos3,
        })
        .png({ quality: 100, compressionLevel: 6 })
        .toBuffer();
      finalBase64 = upscaled.toString("base64");
      finalW = width;
      finalH = height;
      console.log(`[Visual] Upscaled from ${gptW}x${gptH} to ${width}x${height}`);
    } catch (upErr) {
      console.warn("[Visual] Upscale failed, using original resolution:", upErr);
    }
  }

  // Composite brand logo AFTER upscaling (so logo stays crisp and is TOP layer)
  console.log(`[Visual] Logo check: hasLogo=${hasLogo}, brandLogo exists=${!!params.brandLogo}, brandLogo length=${params.brandLogo?.length || 0}`);
  if (hasLogo && params.brandLogo) {
    try {
      console.log(`[Visual] Attempting logo compositing on ${finalW}x${finalH} canvas...`);
      finalBase64 = await compositeLogo(finalBase64, params.brandLogo, `${finalW}x${finalH}`);
      console.log("[Visual] Logo composited successfully (TOP LAYER)");
    } catch (logoErr) {
      console.error("[Visual] Logo compositing failed:", logoErr);
      console.error("[Visual] Logo compositing error details:", logoErr instanceof Error ? logoErr.stack : logoErr);
    }
  } else {
    console.log("[Visual] Skipping logo compositing - no logo provided");
  }

  const imageUrl = `data:image/png;base64,${finalBase64}`;

  return {
    imageUrl,
    svgContent: null,
    pipeline: "direct" as const,
    model: "gpt-image-1",
    promptUsed: designPrompt,
  };
}

/**
 * Composite the brand logo onto a generated PNG image.
 * Places the logo in the top-left corner with dynamic sizing based on canvas dimensions.
 * Uses the same sizing logic as the Claude pipeline for consistency.
 * Handles both data URIs and URL paths.
 */
async function compositeLogo(
  imageBase64: string,
  logoSource: string,
  gptSize: string
): Promise<string> {
  // Parse dimensions from gptSize
  const [imgW, imgH] = gptSize.split("x").map(Number);
  const smallerDim = Math.min(imgW, imgH);

  // Calculate dynamic logo size - LARGE and prominent
  // Target: 18% of smaller dimension, minimum 120px, maximum 300px
  const logoSize = Math.max(120, Math.min(Math.round(smallerDim * 0.18), 300));

  // Position: closer to top-left corner (2% from left, 1.5% from top)
  const logoX = Math.round(imgW * 0.02);
  const logoY = Math.round(imgH * 0.015);

  console.log(`[Visual] Compositing logo: target size=${logoSize}px at (${logoX}, ${logoY}) on ${imgW}x${imgH} canvas`);

  // Get logo buffer - handle both data URI and URL path
  let logoBuffer: Buffer;

  if (logoSource.startsWith("data:")) {
    // It's a data URI - extract base64
    const logoBase64 = logoSource.replace(/^data:image\/[^;]+;base64,/, "");
    if (!logoBase64) {
      throw new Error("Invalid logo data URI");
    }
    logoBuffer = Buffer.from(logoBase64, "base64");
    console.log("[Visual] Logo loaded from data URI");
  } else if (logoSource.startsWith("/") || logoSource.startsWith("http")) {
    // It's a URL path - read from disk or fetch
    const fs = await import("fs/promises");
    const path = await import("path");

    if (logoSource.startsWith("/")) {
      // Local file path (e.g., /uploads/media/abc.png)
      const localPath = path.join(process.cwd(), "public", logoSource);
      console.log(`[Visual] Loading logo from local path: ${localPath}`);
      logoBuffer = await fs.readFile(localPath);
    } else {
      // Remote URL - fetch it
      console.log(`[Visual] Fetching logo from URL: ${logoSource}`);
      const response = await fetch(logoSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch logo: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      logoBuffer = Buffer.from(arrayBuffer);
    }
  } else {
    throw new Error(`Unknown logo source format: ${logoSource.substring(0, 50)}...`);
  }

  // STEP 1: Trim transparent padding from logo to get actual content
  // This ensures the logo fills the target size instead of including empty space
  let trimmedLogo: Buffer;
  try {
    trimmedLogo = await sharp(logoBuffer)
      .trim({ threshold: 10 }) // Trim near-transparent pixels
      .png()
      .toBuffer();

    const trimmedMeta = await sharp(trimmedLogo).metadata();
    console.log(`[Visual] Logo trimmed: ${trimmedMeta.width}x${trimmedMeta.height}px (removed transparent padding)`);
  } catch (trimErr) {
    // If trim fails (e.g., no transparent pixels), use original
    console.log("[Visual] Logo trim skipped (no padding to remove)");
    trimmedLogo = logoBuffer;
  }

  // STEP 2: Resize trimmed logo to target size (maintain aspect ratio)
  const resizedLogo = await sharp(trimmedLogo)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const finalMeta = await sharp(resizedLogo).metadata();
  console.log(`[Visual] Logo final size: ${finalMeta.width}x${finalMeta.height}px`);

  // Composite onto the design image
  const designBuffer = Buffer.from(imageBase64, "base64");
  const result = await sharp(designBuffer)
    .composite([{
      input: resizedLogo,
      left: logoX,
      top: logoY,
    }])
    .png()
    .toBuffer();

  return result.toString("base64");
}

/**
 * Convert a logo source (URL or data URI) to a data URI.
 * Used to ensure logos are properly embedded in SVGs and for image compositing.
 */
async function getLogoAsDataUri(logoSource: string): Promise<string> {
  // If already a data URI, return as-is
  if (logoSource.startsWith("data:")) {
    return logoSource;
  }

  // It's a URL path - read from disk or fetch
  const fs = await import("fs/promises");
  const path = await import("path");

  let logoBuffer: Buffer;
  let mimeType = "image/png"; // default

  if (logoSource.startsWith("/")) {
    // Local file path (e.g., /uploads/media/abc.png)
    const localPath = path.join(process.cwd(), "public", logoSource);
    console.log(`[Visual] Loading logo from local path: ${localPath}`);
    logoBuffer = await fs.readFile(localPath);

    // Detect mime type from extension
    const ext = path.extname(logoSource).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".svg") mimeType = "image/svg+xml";
    else if (ext === ".gif") mimeType = "image/gif";
  } else if (logoSource.startsWith("http")) {
    // Remote URL - fetch it
    console.log(`[Visual] Fetching logo from URL: ${logoSource}`);
    const response = await fetch(logoSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch logo: ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType) mimeType = contentType.split(";")[0];
    const arrayBuffer = await response.arrayBuffer();
    logoBuffer = Buffer.from(arrayBuffer);
  } else {
    throw new Error(`Unknown logo source format: ${logoSource.substring(0, 50)}...`);
  }

  // Convert to data URI
  const base64 = logoBuffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Use Claude vision to check if a brand logo contains the brand name text.
 * Returns true if the logo already has the name visible, false if it's just an icon.
 * Handles both data URIs and URL paths.
 */
async function logoContainsBrandName(
  logoSource: string,
  brandName: string
): Promise<boolean> {
  try {
    // Convert logo to data URI if needed
    const logoDataUri = await getLogoAsDataUri(logoSource);

    const mediaTypeMatch = logoDataUri.match(/^data:(image\/[^;]+);base64,/);
    if (!mediaTypeMatch) return false;

    const mediaType = mediaTypeMatch[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    const base64Data = logoDataUri.replace(/^data:image\/[^;]+;base64,/, "");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          {
            type: "text",
            text: `Does this logo contain the text "${brandName}" (or a very similar spelling)? Answer ONLY "yes" or "no".`,
          },
        ],
      }],
    });

    const answer = response.content[0]?.type === "text" ? response.content[0].text.toLowerCase().trim() : "";
    console.log(`[Visual] Logo name analysis: "${answer}" for brand "${brandName}"`);
    return answer.startsWith("yes");
  } catch (err) {
    console.warn("[Visual] Logo analysis failed, assuming name is present:", err);
    return true; // Safe default: assume logo has the name (avoid duplicate)
  }
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE PIPELINE — hybrid: Claude analysis + OpenAI images + Claude SVG
// ═══════════════════════════════════════════════════════════════

async function runClaudePipeline(params: PipelineParams) {
  const {
    prompt, category, width, height, style,
    brandColors, heroType, textMode,
    brandLogo, brandName, contactInfo,
    showBrandName = true, showSocialIcons, socialHandles,
  } = params;

  const brandColorSection = brandColors
    ? `\nBrand Colors: ${JSON.stringify(brandColors)}`
    : "";

  // Detect extreme aspect ratios for layout adaptation
  const aspectRatio = width / height;
  const isWideBanner = aspectRatio >= 2.5; // Facebook Cover (2.63), Twitter Header (3.0), Leaderboard (8.1), LinkedIn Cover (4.0), Horizontal Sign (3.0)
  const isTallBanner = aspectRatio <= 0.4; // Wide Skyscraper (0.27), Vertical Sign (0.33)

  // Pre-compute banner layout values (used in both analysis and composition prompts)
  const isVeryShort = height < 200;
  // Font sizes — scale with height for wide banners, with reasonable max caps
  // Larger banners (like 3000x1000) need bigger text to fill the space
  const bHeadline = isVeryShort
    ? Math.min(Math.round(height * 0.22), 20)
    : Math.max(48, Math.min(Math.round(height * 0.14), 160)); // 48px min, 14% of height, 160px max
  const bSubtitle = isVeryShort
    ? Math.min(Math.round(height * 0.14), 13)
    : Math.max(24, Math.min(Math.round(height * 0.08), 80)); // 24px min, 8% of height
  const bBrand = isVeryShort
    ? Math.min(Math.round(height * 0.16), 15)
    : Math.max(28, Math.min(Math.round(height * 0.09), 90)); // 28px min, 9% of height
  const bCta = isVeryShort
    ? Math.min(Math.round(height * 0.15), 14)
    : Math.max(24, Math.min(Math.round(height * 0.08), 72)); // 24px min, 8% of height
  const bContact = isVeryShort ? 0 : Math.max(16, Math.min(Math.round(height * 0.06), 56)); // 16px min, 6% of height, 56px max
  // Banner social icons - scale with height
  const bSocialIcon = isVeryShort ? 0 : Math.max(18, Math.min(Math.round(height * 0.06), 48)); // 18-48px icon size
  const bSocialText = isVeryShort ? 0 : Math.max(12, Math.min(Math.round(height * 0.045), 36)); // 12-36px text size
  const bLogo = isVeryShort
    ? Math.min(Math.round(height * 0.6), 60)
    : Math.max(100, Math.min(Math.round(height * 0.28), 500)); // 100-500px, scales with banner height - LARGER
  const bCenterY = Math.round(height / 2);
  // Top margin for hero to avoid head cutting (even in wide banners)
  const bHeroTopMargin = Math.round(height * 0.12); // 12% margin for better headroom
  // Text should stay within left portion, not overlap hero
  const bTextMaxX = Math.round(width * 0.52); // Text must not extend past 52% of width

  // ══ STANDARD LAYOUT — Dynamic text sizing based on canvas area ══
  // This ensures text is appropriately sized for any canvas dimension
  // Uses the geometric mean of width and height as a base, with min/max constraints
  const canvasArea = width * height;
  const baseFactor = Math.sqrt(canvasArea) / 25; // Normalize to a reasonable base (larger = bigger text)

  // Standard layout font sizes (for non-banner designs)
  // Increased multipliers and max caps to fill canvas better
  const sHeadline = Math.max(36, Math.min(Math.round(baseFactor * 2.8), 140)); // 36px min, 140px max
  const sSubtitle = Math.max(18, Math.min(Math.round(baseFactor * 1.3), 56));  // 18px min, 56px max
  const sBrand = Math.max(20, Math.min(Math.round(baseFactor * 1.4), 60));     // 20px min, 60px max
  const sCta = Math.max(18, Math.min(Math.round(baseFactor * 1.1), 48));       // 18px min, 48px max
  const sBody = Math.max(16, Math.min(Math.round(baseFactor * 0.9), 36));      // 16px min, 36px max
  const sContact = Math.max(14, Math.min(Math.round(baseFactor * 0.8), 48));   // 14px min, 48px max - scales with canvas
  const sLogo = Math.max(120, Math.min(Math.round(Math.min(width, height) * 0.25), 600)); // 120-600px, scales with smallest dimension - LARGE and prominent

  // Hero image positioning — leave top 12% clear to avoid head cutting
  const heroTopMargin = Math.round(height * 0.12);

  // ── STEP 1: Claude analyzes and plans images ──

  const analysisPrompt = `You are an expert creative director at a top ad agency planning a professional social media visual.

DESIGN REQUEST: "${prompt}"
Category: ${category.replace("_", " ")}
Canvas Dimensions: ${width}x${height}${isWideBanner ? ` (WIDE BANNER — height is very small, everything must fit within ${height}px tall)` : isTallBanner ? ` (TALL/NARROW — width is very small, everything must fit within ${width}px wide)` : ""}
Visual Style: ${style || "modern"}
${brandColorSection}

${isWideBanner ? `CRITICAL — WIDE BANNER LAYOUT (${width}x${height}):
This is an extremely wide, short banner. All content must fit within ${height}px height.
- LAYOUT: Horizontal flow — logo on FAR LEFT, then headline text, then CTA, then hero on FAR RIGHT
- Keep ALL text and elements within the ${height}px height constraint
- NO stacking of many text lines — everything must be compact horizontally
- Hero element should be small (max ${Math.round(height * 0.9)}px tall)
- Social icons should be tiny (20-30px) or omitted entirely
- Font sizes must be proportional to HEIGHT, not width
` : isTallBanner ? `CRITICAL — TALL BANNER LAYOUT (${width}x${height}):
This is a narrow, tall banner. All content must fit within ${width}px width.
- LAYOUT: Vertical flow — logo on top, headline below, hero in middle, CTA at bottom
- Keep ALL text within the ${width}px width constraint
- Font sizes must be proportional to WIDTH, not height
` : `Study these reference patterns from professional social media ads:
- LAYOUT: Text content on the LEFT (40-50% of width), hero visual element on the RIGHT (50-60%)
- BACKGROUND: Clean, minimal — soft solid color, subtle gradient, or very lightly textured. NOT a busy photographic scene.
- HERO ELEMENT: The dominant visual occupying 80-90% of the canvas height — VERY LARGE and prominent
- FLOATING ICONS: Glossy 3D social media icons (Facebook, Instagram, Twitter, etc.) floating around the hero
- DEVICE MOCKUP: A phone or tablet showing a relevant UI/app screen
- ENGAGEMENT BADGES: Small notification bubbles (heart icon with numbers like "250", "1.2k")
- TYPOGRAPHY: Very large, bold headline text (takes up significant space), smaller subtitle, prominent CTA button
`}
HERO TYPE: "${heroType || "people"}"
${heroType === "product" ? "The main visual element is a PRODUCT shot — a real product, device, or physical item relevant to the brand/topic." : heroType === "text-only" ? "This design should focus on TYPOGRAPHY only — no person or product photos. Use bold text, geometric shapes, patterns, and decorative SVG elements as the visual focus." : "The main visual element is a PERSON/MODEL — a friendly, professional person relevant to the topic."}

Plan the images needed. Output a JSON object:

1. "backgroundPrompt" - Description for a CLEAN, MINIMAL background:
   - Simple soft gradient, solid color with subtle texture, or minimal abstract shapes
   - Light colors: cream (#F5F0EB), soft white (#F8F8F8), light gray (#F0F0F5), or light pastel matching brand colors
   - NO busy photographs, NO complex scenes, NO people in the background
   - The background must be CLEAN so the hero element and text are the stars
   - NEVER include any text, words, or typography
   - Think: professional ad backdrop, clean studio background
${heroType === "text-only" ? "   - For text-only designs, the background can be more vibrant or use a bold gradient to compensate for no hero image" : ""}

2. "elements" - An array of photorealistic images to generate with TRANSPARENT background:
   - "id": unique identifier
   - "prompt": detailed description of the object ONLY (no background description)
   - "role": one of "person", "social_icon", "device", "product", "object", "decoration"
   - "suggestedSize": { "w": pixel width, "h": pixel height }
   - "suggestedPosition": { "x": pixel X, "y": pixel Y }

${heroType === "text-only" ? `   For TEXT-ONLY designs: Include 2-3 small supporting elements like glossy 3D social icons or decorative 3D shapes. NO person, NO large product.${isWideBanner ? ` Keep elements small (${height < 200 ? "20-30" : "40-60"}px) to fit the ${height}px height.` : ""}` : isWideBanner ? `   For this WIDE BANNER/COVER (${width}x${height}):
   a) HERO (role: "${heroType === "product" ? "product" : "person"}") — Hero element on the FAR RIGHT.
      - Must fit within ${Math.round(height * 0.9)}px height
      - Size: approximately ${Math.min(Math.round(height * 0.85), 400)}x${Math.min(Math.round(height * 0.85), 400)} pixels
      - Position: far right side (x=${Math.round(width * 0.82)}, y=${Math.round(height * 0.05)})
   b) ${height < 200 ? "NO social icons — too small at this scale" : "0-1 small social icons (40-60px) — only if space permits"}` : heroType === "product" ? `   REQUIRED ELEMENTS:
   a) PRODUCT (role: "product") — The HERO element. A photorealistic product shot relevant to the design.
      - Clean product photography, well-lit, professional
      - The ENTIRE product must be fully visible — do NOT crop or cut off any part
      - Center the product within the image frame with some breathing room around it
      - VERY LARGE: at least ${Math.round(width * 0.55)}x${Math.round(height * 0.65)} pixels — the product should DOMINATE the right side
      - Position on the RIGHT side of canvas, vertically centered
   b) 1-2 SMALL SOCIAL ICONS (role: "social_icon"):
      - Glossy 3D social media icons
      - SMALL SIZE ONLY: 60-90px each — these are accents, NOT the focus
      - They must NOT overlap the product or the text area` : `   REQUIRED ELEMENTS:
   a) PERSON (role: "person") — The HERO element. A professional, friendly person relevant to the topic.
      - 3/4 BODY SHOT: head down to roughly mid-thigh or knees, standing pose
      - CRITICAL HEADROOM: The person's head must NOT be at the very top of the image — leave 15% empty space above their head
      - The person should be framed so their FEET/LOWER LEGS are at the very bottom edge of the image
      - Looking at camera or gesturing engagingly, professional clothing, confident pose, warm expression
      - VERY LARGE: at least ${Math.round(width * 0.6)}x${Math.round(height * 0.85)} pixels — the person should DOMINATE the right side
      - Position on the RIGHT side of canvas
   b) 1-2 SMALL SOCIAL ICONS (role: "social_icon"):
      - Glossy 3D social media icons (Facebook blue square, Instagram gradient, Twitter bird, etc.)
      - SMALL SIZE ONLY: 60-90px each — these are accents, NOT the focus
      - They must NOT overlap the person or the text area`}

   DESCRIBE EACH ELEMENT AS: the object itself, photorealistic, studio-lit. It will be rendered with transparent/alpha background.

3. "overlayPlan" - Text and SVG elements Claude should add:
${isWideBanner ? `   - WIDE BANNER/COVER LAYOUT (${width}x${height}): Everything must fit in ${height}px height!
   - ${isVeryShort ? "SINGLE ROW: all text on ONE horizontal line at y=" + bCenterY + ", no vertical stacking" : "2-4 rows with fixed y-coordinates, well-spaced vertically"}
   - Brand logo/name on the far left (small, ~${bLogo}px tall)
   - Headline: ${isVeryShort ? "ONE LINE only, font-size " + bHeadline + "px" : "ONE LINE only (shorten if needed), font-size " + bHeadline + "px max"}, bold
   - ${isVeryShort ? "NO subtitle, NO contact info — not enough vertical space" : "Short subtitle font-size " + bSubtitle + "px, CTA font-size " + bCta + "px"}
   - ${isVeryShort ? "NO engagement badges, NO floating icons — not enough space" : "Optional: 1-2 tiny engagement badges if space permits"}
   - Use brand colors for CTA, dark color for headline
   - CRITICAL: ALL text MUST stay within the LEFT 52% of the canvas (max x=${bTextMaxX}). The hero person occupies the right side.
   - CRITICAL: text must NEVER overlap the person — each element at its own fixed position` : isTallBanner ? `   - TALL BANNER LAYOUT (${width}x${height}): Everything must fit in ${width}px width!
   - Brand logo/name at top (small, ~${Math.round(width * 0.5)}px wide)
   - Headline: font-size ${Math.round(width * 0.12)}px, bold, centered
   - Short subtitle below, font-size ${Math.round(width * 0.07)}px
   - CTA button centered, font-size ${Math.round(width * 0.07)}px
   - Distribute content VERTICALLY across the full ${height}px height
   - Use brand colors for CTA, dark color for headline` : `   - Brand logo/name in top-left corner
   - VERY LARGE bold headline on the LEFT side (font-size ${Math.round(width * 0.065)}px+)
   - Subtitle text below headline (lighter weight, font-size ${Math.round(width * 0.035)}px)
   - Body text or bullet points
   - Prominent CTA button (rounded rectangle, brand color fill, white bold text)
   - Small floating engagement badges as SVG (circle with heart + number like "250")
   - Floating decorative circles or curved shapes in brand colors with low opacity
   - Use brand colors for CTAs and accents, dark color for headline text`}

Respond with ONLY the JSON object, no markdown.`;

  const analysisResponse = await ai.generate(analysisPrompt, {
    maxTokens: 2048,
    temperature: 0.7,
    systemPrompt: "You are an expert creative director. Output ONLY valid JSON with no markdown code blocks.",
  });

  let analysis: DesignAnalysis;

  try {
    const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : analysisResponse);
    const elements = Array.isArray(parsed.elements) ? parsed.elements.slice(0, 5) : [];
    analysis = {
      backgroundPrompt: parsed.backgroundPrompt || prompt,
      elements,
      overlayPlan: parsed.overlayPlan || "Add professional typography and design elements.",
    };
    console.log(`[Visual] Claude analysis: ${elements.length} elements: ${elements.map((e: ElementImage) => `${e.id}(${e.role})`).join(", ")}`);
  } catch (parseError) {
    console.error("[Visual] Failed to parse analysis JSON:", parseError);
    analysis = {
      backgroundPrompt: `Professional, high-quality photo for a ${category.replace("_", " ")} design about: ${prompt}. Studio lighting, clean composition, no text.`,
      elements: [],
      overlayPlan: "Add headline text, subtitle, and call-to-action with modern typography.",
    };
  }

  // Ensure hero element exists
  if (heroType !== "text-only") {
    const hasHeroInPlan = analysis.elements.some(
      (e) => e.role === "person" || e.role === "product"
    );
    if (!hasHeroInPlan) {
      console.warn(`[Visual] Analysis missing hero for heroType="${heroType}". Injecting.`);
      const defaultHero: ElementImage = heroType === "product"
        ? {
            id: "hero_product",
            prompt: `A professional product shot relevant to: ${prompt}. Clean, well-lit studio photography, photorealistic, centered.`,
            role: "product",
            suggestedSize: { w: Math.round(width * 0.55), h: Math.round(height * 0.65) },
            suggestedPosition: { x: Math.round(width * 0.35), y: Math.round(height * 0.2) },
          }
        : {
            id: "hero_person",
            prompt: `A professional, friendly person relevant to "${prompt}". Business casual clothing, confident standing pose, 3/4 body shot from head to knees, warm smile, looking at camera.`,
            role: "person",
            suggestedSize: { w: Math.round(width * 0.6), h: Math.round(height * 0.85) },
            suggestedPosition: { x: Math.round(width * 0.35), y: Math.round(height * 0.1) },
          };
      analysis.elements.unshift(defaultHero);
    }
  }

  // ── STEP 2: OpenAI generates ALL images in parallel ──

  let bgSize: "1024x1024" | "1536x1024" | "1024x1536" | "auto" = "auto";
  if (aspectRatio > 1.3) bgSize = "1536x1024";
  else if (aspectRatio < 0.77) bgSize = "1024x1536";
  else bgSize = "1024x1024";

  const photoStyle = getPhotoStyleDirection(style || "modern");

  const imagePromises: Promise<{ id: string; base64: string | null }>[] = [];

  const fullBgPrompt = `${analysis.backgroundPrompt}\n\nStyle direction: ${photoStyle}\n\nCRITICAL REQUIREMENTS:\n- This is a BACKGROUND for a professional social media ad\n- Keep it CLEAN and MINIMAL — soft gradient, subtle texture, or simple abstract shapes\n- NO people, NO products, NO complex scenes in the background\n- NO text, words, letters, numbers, watermarks, or typography\n- Light, airy colors that let overlaid text and elements stand out\n- Think: professional ad backdrop, clean studio background wall`;
  imagePromises.push(
    openaiClient.generateImage(fullBgPrompt, { size: bgSize, quality: "high" })
      .then(base64 => ({ id: "background", base64 }))
  );

  for (const element of analysis.elements) {
    const isHero = element.role === "person" || element.role === "product";
    const elQuality = isHero ? "high" : "medium";
    const isPersonRole = element.role === "person";
    const isProductRole = element.role === "product";
    const framingNote = isPersonRole
      ? "\n- FRAMING: 3/4 body shot — head down to approximately mid-thigh or knees. The person should be standing in a confident pose.\n- CRITICAL HEADROOM: Leave at least 15% of the image height as EMPTY SPACE above the person's head. The top of their head should be at approximately y=15% of the image, NOT at the very top edge.\n- The person's lower legs/feet should be at the VERY BOTTOM edge of the image frame.\n- Center the person horizontally in the frame.\n- Clean edges all around with no artifacts."
      : isProductRole
      ? "\n- FRAMING: Show the COMPLETE product with all parts fully visible. Do NOT crop any part of the product. Leave some breathing room around it.\n- The product should be centered in the frame."
      : "";
    const elementPrompt = `${element.prompt}\n\nCRITICAL RENDERING REQUIREMENTS:\n- Completely transparent/empty background — pure alpha channel\n- The subject must be COMPLETELY isolated: no floor, no surface, no ground plane, no shadow on ground, no pedestal, no reflection surface\n- Clean edges with no visible fringing, halos, or white outlines\n- Professional studio lighting, photorealistic, high detail\n- Absolutely NO text, words, letters, or typography anywhere in the image\n- The subject should appear to float in empty space${framingNote}`;
    imagePromises.push(
      openaiClient.generateImage(elementPrompt, { size: "1024x1024", quality: elQuality, transparent: true })
        .then(base64 => ({ id: element.id, base64 }))
    );
  }

  const imageResults = await Promise.all(imagePromises);

  const backgroundBase64 = imageResults.find(r => r.id === "background")?.base64 || null;
  const elementImages: { id: string; base64: string; role: string; size: { w: number; h: number }; position: { x: number; y: number } }[] = [];

  for (const element of analysis.elements) {
    const result = imageResults.find(r => r.id === element.id);
    if (result?.base64) {
      elementImages.push({
        id: element.id,
        base64: result.base64,
        role: element.role,
        size: element.suggestedSize || { w: 200, h: 200 },
        position: element.suggestedPosition || { x: 0, y: 0 },
      });
    } else {
      console.warn(`[Visual] Element "${element.id}" (${element.role}) failed`);
    }
  }

  // Retry hero if it failed
  const requestedHero = heroType !== "text-only";
  const heroGenerated = elementImages.some(e => e.role === "person" || e.role === "product");
  if (requestedHero && !heroGenerated) {
    console.warn("[Visual] Hero failed. Retrying...");
    const heroElement = analysis.elements.find(e => e.role === "person" || e.role === "product");
    const retryRole = heroType === "product" ? "product" : "person";
    const retryPrompt = retryRole === "person"
      ? `A professional, friendly person in business casual clothing, confident standing pose, 3/4 body shot from head to knees, looking at camera with a warm smile. Studio lighting, photorealistic.\n\nCRITICAL FRAMING: Leave 15% empty space ABOVE the person's head. Feet at the very bottom edge. The head should NOT touch the top of the image.\n\nCRITICAL: Transparent/empty background, pure alpha channel. No floor, no surface, no ground. The person must be completely isolated floating in empty space. No text anywhere.`
      : `A clean, professional product shot. Well-lit, studio photography. The complete product centered in frame with breathing room.\n\nCRITICAL: Transparent/empty background, pure alpha channel. No floor, no surface, no ground. The product must be completely isolated. No text anywhere.`;

    const retryResult = await openaiClient.generateImage(retryPrompt, {
      size: "1024x1024",
      quality: "high",
      transparent: true,
    });

    if (retryResult) {
      const retryId = heroElement?.id || `retry_${retryRole}`;
      console.log(`[Visual] Hero retry succeeded: "${retryId}"`);
      elementImages.push({
        id: retryId,
        base64: retryResult,
        role: retryRole,
        size: heroElement?.suggestedSize || { w: Math.round(width * 0.6), h: Math.round(height * 0.85) },
        position: heroElement?.suggestedPosition || { x: Math.round(width * 0.35), y: Math.round(height * 0.1) },
      });
    } else {
      console.error("[Visual] Hero retry also failed.");
    }
  }

  const totalImagesGenerated = (backgroundBase64 ? 1 : 0) + elementImages.length;

  // ── STEP 3: Claude composes SVG with placeholder tokens ──

  const styleGuide = getStyleGuide(style || "modern");
  let compositionPrompt: string;

  // Determine text instruction based on textMode
  const textModeInstruction = textMode === "exact"
    ? `USE THIS EXACT TEXT as the headline/main text on the design (do NOT change the wording):\n"${prompt}"\nAdd a short CTA button like "Learn More" or "Get Started".`
    : `Create compelling ad copy based on this topic: "${prompt}"\nGenerate a bold headline, short subtitle, and CTA button text.`;

  // Brand name display text - only show if showBrandName is true
  const brandNameDisplay = showBrandName && brandName ? brandName : "";

  // Social handles section for composition prompt - sizes scale with canvas
  // Use banner sizes for wide/tall banners, standard sizes otherwise
  const sSocialIcon = Math.max(20, Math.min(Math.round(baseFactor * 0.9), 48)); // 20-48px icon size (standard)
  const sSocialText = Math.max(12, Math.min(Math.round(baseFactor * 0.6), 28)); // 12-28px text size (standard)
  const socialIconSize = isWideBanner || isTallBanner ? bSocialIcon : sSocialIcon;
  const socialTextSize = isWideBanner || isTallBanner ? bSocialText : sSocialText;
  // Calculate social handles Y position - push to very bottom of canvas
  const socialY = Math.round(height * 0.96); // Very bottom of canvas (96%)

  const socialHandlesSection = showSocialIcons && socialHandles && Object.keys(socialHandles).length > 0 && socialIconSize > 0
    ? `\n\nSOCIAL MEDIA HANDLES — Position at VERY BOTTOM of the canvas:
${Object.entries(socialHandles).map(([platform, handle]) =>
  `   - ${platform === "twitter" ? "X (Twitter)" : platform.charAt(0).toUpperCase() + platform.slice(1)}: @${handle}`
).join("\n")}
   *** CREATE SVG ICONS FOR EACH PLATFORM (REQUIRED): ***
   - Each platform needs a small ${socialIconSize}px colored circle/square icon:
     * Instagram: pink/gradient circle (#E1306C)
     * Facebook: blue circle (#1877F2) with "f" letter
     * Twitter/X: black circle (#000000) with "X" letter
     * LinkedIn: blue square (#0A66C2) with "in" letters
     * TikTok: black circle with white/pink accent
   - Place icon followed by @handle text for each platform
   - Font-size: ${socialTextSize}px, font-weight 500, color: dark gray (#555)
   - Arrange horizontally with ${Math.round(socialIconSize * 2)}px spacing between each platform
   *** POSITIONING (CRITICAL): ***
   - y = ${socialY}px (this is at 96% of canvas height - VERY BOTTOM)
   - x = ${Math.round(width * 0.04)}px (left-aligned)
   - This MUST be clearly separated from contact info above`
    : "";

  if (backgroundBase64 || elementImages.length > 0) {
    let imagesSection = "\nAVAILABLE IMAGES — use the placeholder tokens as href values:\n";

    if (params.brandLogo) {
      // Use appropriate logo size for layout type
      const actualLogoSize = isWideBanner || isTallBanner ? bLogo : sLogo;
      const brandNameInstruction = showBrandName && brandName
        ? ` It should be followed by the brand name "${brandName}" as text.`
        : " No brand name text needed next to the logo (the logo already contains the brand name or user prefers logo only).";
      imagesSection += `\n[BRAND LOGO] — use href="${IMG_PLACEHOLDER_LOGO}"
  Place as: <image href="${IMG_PLACEHOLDER_LOGO}" x="${Math.round(width * 0.03)}" y="${Math.round(height * 0.02)}" width="${actualLogoSize}" height="${actualLogoSize}" preserveAspectRatio="xMidYMid meet"/>
  This is the ACTUAL brand logo image — it MUST be LARGE and PROMINENT (${actualLogoSize}px).
  Place in the TOP-LEFT corner, clearly visible as a key branding element.${brandNameInstruction}\n`;
    }

    if (backgroundBase64) {
      imagesSection += `\n[BACKGROUND IMAGE] — use href="${IMG_PLACEHOLDER_BG}"
  Place as: <image href="${IMG_PLACEHOLDER_BG}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  This is a photorealistic photo that covers the full canvas.\n`;
    }

    for (const el of elementImages) {
      const placeholder = IMG_PLACEHOLDER_EL(el.id);
      const isHeroRole = el.role === "person" || el.role === "product";
      if (isHeroRole && isWideBanner) {
        // For wide banners, hero goes on the far right
        // Use xMaxYMid meet to center vertically (avoids head cutting) and anchor to right edge
        const heroW = Math.round(height * 1.4); // Wider to give more horizontal space
        const heroX = width - heroW;
        imagesSection += `\n[ELEMENT: ${el.id}] Role: ${el.role} (HERO) — use href="${placeholder}"
  Place on the RIGHT side of the banner. Use xMaxYMid to CENTER the person VERTICALLY (head won't be cut).
  <image href="${placeholder}" x="${heroX}" y="0" width="${heroW}" height="${height}" preserveAspectRatio="xMaxYMid meet"/>
  This centers the person vertically so their head has space above and feet have space below.\n`;
      } else if (isHeroRole) {
        // Leave top margin to avoid head cutting
        const heroHeight = height - heroTopMargin;
        imagesSection += `\n[ELEMENT: ${el.id}] Role: ${el.role} (HERO) — use href="${placeholder}"
  COPY THIS EXACTLY — do NOT change any attribute values:
  <image href="${placeholder}" x="${Math.round(width * 0.45)}" y="${heroTopMargin}" width="${Math.round(width * 0.55)}" height="${heroHeight}" preserveAspectRatio="xMidYMax meet" filter="url(#shadow)"/>
  WHY these values:
  - x="${Math.round(width * 0.45)}" = hero starts at 45% of canvas width, leaving space for text on the left
  - y="${heroTopMargin}" = starts ${heroTopMargin}px from top to leave headroom and avoid cutting off the person's head
  - width="${Math.round(width * 0.55)}" = hero occupies the right 55% of the canvas
  - height="${heroHeight}" = image area ends at canvas bottom
  - preserveAspectRatio="xMidYMax meet" = image scaled to fit entirely (head visible), anchored to BOTTOM (feet at canvas edge)
  - The person will occupy roughly the lower 75-85% of the canvas, with clear space above their head
  - TEXT MUST STAY LEFT OF x=${Math.round(width * 0.40)} to avoid overlapping the hero\n`;
      } else {
        imagesSection += `\n[ELEMENT: ${el.id}] Role: ${el.role} — use href="${placeholder}"
  Suggested: <image href="${placeholder}" x="${el.position.x}" y="${el.position.y}" width="${el.size.w}" height="${el.size.h}" preserveAspectRatio="xMidYMid meet"/>
  Place AROUND the hero element but NEVER on top of the person's face or head area. You can adjust x, y, width, height.\n`;
      }
    }

    const hasHeroElement = elementImages.some(e => e.role === "person" || e.role === "product");
    const heroEl = elementImages.find(e => e.role === "person" || e.role === "product");
    const iconEls = elementImages.filter(e => e.role !== "person" && e.role !== "product");

    // Text width constraints - wider for text-only designs
    const isTextOnlyDesign = heroType === "text-only" || !hasHeroElement;
    const textMaxWidth = isTextOnlyDesign ? 0.85 : 0.40; // 85% for text-only, 40% for designs with hero
    const textMaxX = Math.round(width * textMaxWidth);

    // Additional banner layout values for composition prompt only
    const bHeroH = Math.round(height * 0.9);
    const bRx = isVeryShort ? 6 : 12;
    const bPadH = isVeryShort ? 6 : 14;
    const bPadV = isVeryShort ? 3 : 8;
    // Explicit y-positions for taller covers — well-spaced to prevent overlap
    const bBrandY = Math.round(height * 0.10);
    const bHeadlineY = Math.round(height * 0.35);
    const bSubtitleY = Math.round(height * 0.58);
    const bCtaY = Math.round(height * 0.75);
    const bContactY = Math.round(height * 0.90);

    const brandNameInstruction = showBrandName && brandName
      ? `- Brand name "${brandName}"`
      : "- (Logo only, no brand name text needed)";

    const actualLogoSize = isWideBanner || isTallBanner ? bLogo : sLogo;

    compositionPrompt = `You are an expert graphic designer at a top agency composing a professional social media ad.

DESIGN REQUEST: "${prompt}"
DIMENSIONS: ${width}x${height} pixels
VISUAL STYLE: ${style || "modern"}
${brandColorSection}

TEXT MODE: ${textModeInstruction}

OVERLAY PLAN: ${analysis.overlayPlan}

STYLE GUIDE:
${styleGuide}
${imagesSection}

IMPORTANT: The image href values are PLACEHOLDER TOKENS that will be replaced with actual image data. Use them EXACTLY as shown (e.g. href="${IMG_PLACEHOLDER_BG}").

${isWideBanner ? `REFERENCE DESIGN PATTERN — WIDE BANNER/COVER (${width}x${height}):
${isVeryShort ? `*** CRITICAL: This is a VERY SHORT banner (only ${height}px tall). ***
ALL text MUST be on a SINGLE HORIZONTAL ROW at y=${bCenterY}.
Use dominant-baseline="central" on all <text> elements.
DO NOT stack text vertically. NO element should be above or below another.
Every text and button shares the SAME y-coordinate: ${bCenterY}.` : `*** WIDE COVER/BANNER (${height}px tall) — STRICT LAYOUT RULES: ***
Text is arranged in SEPARATE rows, each at a FIXED y-coordinate.
DO NOT deviate from these y-values — they are calculated to prevent overlap.
EVERY <text> element MUST use dominant-baseline="central".
Font sizes are MAXIMUM values — do NOT exceed them.
Headline MUST be ONE LINE ONLY (shorten the text if needed to fit).
NO random decorative text elements (no "{}", no "//", no code symbols).`}

COMPOSITION — layer by layer (bottom to top):

1. BACKGROUND <image> (full canvas):
   <image href="${IMG_PLACEHOLDER_BG}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>

2. SUBTLE OVERLAY (optional):
   - Light gradient or brand color wash at 10-15% opacity — keep minimal

3. HERO ELEMENT${hasHeroElement && heroEl ? " — " + heroEl.role.toUpperCase() : ""}:
${hasHeroElement && heroEl ? "   - COPY THE EXACT <image> TAG from the IMAGES SECTION above\n   - Hero on FAR RIGHT, feet anchored to bottom of banner" : "   - No hero image — use typography as visual focus"}

4. TEXT CONTENT — ${isVeryShort ? "SINGLE ROW LAYOUT" : "FIXED ROW LAYOUT"}:
${isVeryShort ? `   *** ALL elements on ONE horizontal line at y=${bCenterY}, dominant-baseline="central" ***
   Layout left to right across the ${width}px width:

   a. BRAND (x=${Math.round(width * 0.02)}):
      ${params.brandLogo ? '- Logo: <image href="' + IMG_PLACEHOLDER_LOGO + '" x="' + Math.round(width * 0.01) + '" y="' + Math.round((height - bLogo) / 2) + '" width="' + bLogo + '" height="' + bLogo + '" preserveAspectRatio="xMidYMid meet"/>' + (brandNameDisplay ? '\n      - Brand name "' + brandNameDisplay + '": x=' + Math.round(width * 0.01 + bLogo + 5) + ', y=' + bCenterY + ', font-size ' + bBrand + 'px, font-weight 700' : '\n      - (Logo only, no brand name text needed)') : (brandNameDisplay ? '- Brand name "' + brandNameDisplay + '": x=' + Math.round(width * 0.02) + ', y=' + bCenterY + ', font-size ' + bBrand + 'px, font-weight 700' : '- (No brand display in this design)')}

   b. HEADLINE (x=${Math.round(width * 0.18)}, y=${bCenterY}):
      - font-size ${bHeadline}px, font-weight 700, fill="#1a1a1a"
      - ONE LINE ONLY — text MUST END before x=${bTextMaxX} (max ${bTextMaxX - Math.round(width * 0.18)}px wide)
      - MUST NOT overlap the hero person on the right
      - dominant-baseline="central"

   c. CTA BUTTON (x=${Math.round(width * 0.62)}, centered at y=${bCenterY}):
      - Rounded rect: x=${Math.round(width * 0.62)}, y=${bCenterY - Math.round(bCta * 0.7 + bPadV)}, width=${Math.round(width * 0.22)}, height=${Math.round(bCta * 1.4 + bPadV * 2)}, rx=${bRx}, fill with brand primary color
      - TEXT MUST BE CENTERED in the button using text-anchor="middle":
        <text x="${Math.round(width * 0.62 + (width * 0.22) / 2)}" y="${bCenterY}" font-size="${bCta}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">CTA Text</text>
      - The x position is the CENTER of the button rect

   NO subtitle, NO contact info, NO engagement badges — not enough vertical space.` : `   EXACT y-coordinates for each row (DO NOT change these values):
   Each row occupies a fixed vertical position. There are ${Math.round(bHeadlineY - bBrandY)}px between brand and headline, ${Math.round(bSubtitleY - bHeadlineY)}px between headline and subtitle, and ${Math.round(bCtaY - bSubtitleY)}px between subtitle and CTA.

   a. ROW 1 — BRAND (y=${bBrandY}):
      ${params.brandLogo ? '- Logo: <image href="' + IMG_PLACEHOLDER_LOGO + '" x="' + Math.round(width * 0.02) + '" y="' + Math.round(bBrandY - bLogo / 2) + '" width="' + bLogo + '" height="' + bLogo + '" preserveAspectRatio="xMidYMid meet"/>' + (brandNameDisplay ? '\n      - Brand name "' + brandNameDisplay + '": x=' + Math.round(width * 0.02 + bLogo + 8) + ', y=' + bBrandY + ', font-size ' + bBrand + 'px, font-weight 700, dominant-baseline="central"' : '\n      - (Logo only, no brand name text needed)') : (brandNameDisplay ? '- Brand name "' + brandNameDisplay + '": x=' + Math.round(width * 0.03) + ', y=' + bBrandY + ', font-size ' + bBrand + 'px, font-weight 700, dominant-baseline="central"' : '- (No brand display in this design)')}

   b. ROW 2 — HEADLINE (y=${bHeadlineY}):
      - <text x="${Math.round(width * 0.03)}" y="${bHeadlineY}" font-size="${bHeadline}" font-weight="700" fill="#1a1a1a" dominant-baseline="central" textLength="${bTextMaxX - Math.round(width * 0.03)}" lengthAdjust="spacingAndGlyphs">
      - CRITICAL: Text MUST NOT exceed x=${bTextMaxX} (the hero starts at ~${Math.round(width * 0.55)})
      - Shorten the text if needed to fit within ${bTextMaxX - Math.round(width * 0.03)}px width
      - Max font-size: ${bHeadline}px

   c. ROW 3 — SUBTITLE (y=${bSubtitleY}):
      - <text x="${Math.round(width * 0.03)}" y="${bSubtitleY}" font-size="${bSubtitle}" font-weight="400" fill="#555" dominant-baseline="central">
      - CRITICAL: Text MUST NOT exceed x=${bTextMaxX}
      - Keep it SHORT — one line only

   d. CTA BUTTON (centered at y=${bCtaY}):
      - Button rect width: ${Math.round(width * 0.28)}px
      - Rounded rect: x=${Math.round(width * 0.03)}, y=${bCtaY - Math.round(bCta * 0.7 + bPadV)}, width=${Math.round(width * 0.28)}, height=${Math.round(bCta * 1.4 + bPadV * 2)}, rx=${bRx}, fill with brand primary color
      - TEXT MUST BE CENTERED in the button using text-anchor="middle":
        <text x="${Math.round(width * 0.03 + (width * 0.28) / 2)}" y="${bCtaY}" font-size="${bCta}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">CTA Text</text>
      - The x position is the CENTER of the button: ${Math.round(width * 0.03)} + ${Math.round(width * 0.14)} = ${Math.round(width * 0.03 + width * 0.14)}
${contactInfo && (contactInfo.email || contactInfo.phone || contactInfo.website || contactInfo.address) ? `
   e. ROW 5 — CONTACT (y=${bContactY}):
      - <text x="${Math.round(width * 0.03)}" y="${bContactY}" font-size="${bContact}" font-weight="400" dominant-baseline="central">
      - Single line: ${[contactInfo.website, contactInfo.email, contactInfo.phone].filter(Boolean).map(c => '"' + c + '"').join(" · ")}` : ""}${socialHandlesSection}

   CRITICAL RULES:
   - NO text element may have a y-value other than the ones listed above
   - NO decorative text symbols (no "{}", "//", or code-like characters)
   - NO <tspan> elements — each row is a single <text> element
   - ALL TEXT MUST END BEFORE x=${bTextMaxX} — the hero person occupies the RIGHT side starting around x=${Math.round(width * 0.55)}
   - Text MUST NOT overlap the person/hero image — leave a clear gap between text and the subject`}

5. NO decorative shapes that could overlap text — keep the design clean and readable.
` : `REFERENCE DESIGN PATTERN (follow this layout closely):
Think of professional Instagram/Facebook ads from brands like Hootsuite, Buffer, Canva, Later:
- Clean, airy feel with a minimal background
- ${hasHeroElement ? `Person/product on the RIGHT, ANCHORED TO THE BOTTOM — feet touching bottom, HEAD FULLY VISIBLE with ${heroTopMargin}px clear space above (never cropped at top)` : "Bold typography as the visual centerpiece"}
- Large, impactful MULTI-LINE headline text on the LEFT (2-4 lines to fill space)
- Subtitle text below the headline
- 2-3 bullet points listing key benefits/features
- Floating social icons scattered around the hero but NEVER covering the person's FACE or HEAD
- Engagement notification badges (SVG: small rounded rect with heart + number)
- Prominent CTA button at the LEFT, vertically around 75% of canvas height
- Brand name/logo top-left
${contactInfo && (contactInfo.email || contactInfo.phone || contactInfo.website || contactInfo.address) ? "- Contact details below the CTA button, naturally integrated into the left-side text\n" : ""}- FILL THE LEFT SIDE — no large empty areas, use all the text elements to create a complete ad

COMPOSITION — layer by layer (bottom to top):

1. BACKGROUND <image> (full canvas):
   <image href="${IMG_PLACEHOLDER_BG}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>

2. SUBTLE OVERLAY (optional, light):
   - If background is already clean/light, skip heavy overlays
   - At most, add subtle decorative curved shapes or gradient wash in brand colors with opacity 0.1-0.2

3. DECORATIVE SVG SHAPES (brand color accents):
   - 2-3 large soft circles with brand colors at 10-20% opacity scattered in corners
   - A curved wave or organic blob shape for visual interest
   - Thin accent lines or borders

4. HERO ELEMENT${hasHeroElement && heroEl ? ` — ${heroEl.role.toUpperCase()}` : ""}:
${hasHeroElement && heroEl ? `   - COPY THE EXACT <image> TAG from the IMAGES SECTION above — do NOT modify any attributes
   - Reminder:
     <image href="${IMG_PLACEHOLDER_EL(heroEl.id)}" x="${Math.round(width * 0.45)}" y="${heroTopMargin}" width="${Math.round(width * 0.55)}" height="${height - heroTopMargin}" preserveAspectRatio="xMidYMax meet" filter="url(#shadow)"/>
   - x="${Math.round(width * 0.45)}" = hero starts at 45% of canvas width, leaving 0-40% for text
   - y="${heroTopMargin}" leaves ${heroTopMargin}px clear at the top to avoid cutting off the person's head
   - xMidYMax meet = scales image to fit entirely (no cropping), then anchors to BOTTOM
   - Result: feet touch the canvas bottom, head has ${heroTopMargin}px of clear space above
   - The ${heroEl.role} occupies the right ~55% of canvas width (x: 45%-100%)
   - ALL TEXT MUST STAY LEFT OF x=${textMaxX} to avoid overlapping the hero
   - CRITICAL: NO icons, badges, text should overlap the ${heroEl.role}'s FACE or HEAD. The TOP ${Math.round(height * 0.30)}px of the hero area is a NO-GO ZONE for overlays.` : "   - No hero image — use bold typography and shapes as the visual focus. TEXT-ONLY MODE: Spread text across the FULL canvas width for maximum impact!"}

5. FLOATING ICON ELEMENTS:
${iconEls.length > 0 ? `   - Position each icon image floating around ${isTextOnlyDesign ? "the design" : "the hero element"}
   - Size: 50-80px each — small accents, NOT focal points
   - STRICT PLACEMENT — only use these SAFE ZONES (pixel coordinates):
${isTextOnlyDesign ? `     * ZONE A (corners): x=${Math.round(width * 0.02)}-${Math.round(width * 0.15)}, y=${Math.round(height * 0.02)}-${Math.round(height * 0.15)} OR x=${Math.round(width * 0.85)}-${Math.round(width * 0.98)}, y=${Math.round(height * 0.02)}-${Math.round(height * 0.15)}
     * ZONE B (right edge): x=${Math.round(width * 0.85)}-${Math.round(width * 0.98)}, y=${Math.round(height * 0.35)}-${Math.round(height * 0.65)}
     * ZONE C (bottom corners): x=${Math.round(width * 0.02)}-${Math.round(width * 0.15)}, y=${Math.round(height * 0.85)}-${Math.round(height * 0.98)} OR x=${Math.round(width * 0.85)}-${Math.round(width * 0.98)}, y=${Math.round(height * 0.85)}-${Math.round(height * 0.98)}` : `     * ZONE A (gap between text and hero): x=${Math.round(width * 0.40)}-${Math.round(width * 0.50)}, y=${Math.round(height * 0.35)}-${Math.round(height * 0.65)}
     * ZONE B (bottom-right corner): x=${Math.round(width * 0.75)}-${Math.round(width * 0.92)}, y=${Math.round(height * 0.7)}-${Math.round(height * 0.9)}
     * ZONE C (top-right edge): x=${Math.round(width * 0.8)}-${Math.round(width * 0.93)}, y=${Math.round(height * 0.02)}-${Math.round(height * 0.12)}`}
   - FORBIDDEN ZONES — NEVER place icons here:
${isTextOnlyDesign ? `     * Over main text area: x=${Math.round(width * 0.10)}-${Math.round(width * 0.90)}, y=${Math.round(height * 0.15)}-${Math.round(height * 0.85)}` : `     * Hero face/head area: x=${Math.round(width * 0.45)}-${Math.round(width * 0.85)}, y=${Math.round(height * 0.02)}-${Math.round(height * 0.35)}
     * Text area: x=0-${textMaxX}, y=0-${Math.round(height * 0.85)}`}
   - Rotate some slightly (5-15 degrees) for dynamic feel
   - Apply drop-shadow filter to each
   - Spread icons across different zones — do NOT cluster them together` : `   - Create SVG social icon badges: small rounded squares (40-60px) with icon-like shapes inside, in brand colors like blue (#1877F2), pink (#E1306C), light blue (#1DA1F2)
${isTextOnlyDesign ? `   - SAFE ZONES: corners and edges only (not over main text)` : `   - SAFE ZONES ONLY: gap between text and hero (x=${textMaxX}-${Math.round(width * 0.50)}), or bottom-right (x>${Math.round(width * 0.75)}, y>${Math.round(height * 0.7)})`}
   - NEVER place on ${isTextOnlyDesign ? "the main text content area" : "the hero's face/head or over the text area"}`}

6. TEXT CONTENT — ${isTextOnlyDesign ? "FULL WIDTH available (no hero)" : `STRICTLY on the LEFT side (x: ${Math.round(width * 0.04)} to ${textMaxX} MAX)`}:
   *** CRITICAL: ALL text MUST stay within x=0 to x=${textMaxX} ***
   ${isTextOnlyDesign ? "*** TEXT-ONLY DESIGN: Use the FULL canvas width for text - make it BIG and IMPACTFUL ***" : "*** The hero/product occupies the RIGHT side — text MUST NOT extend into that area ***"}
   *** DYNAMIC FONT SIZES (calculated for ${width}x${height} canvas): ***

   a. BRAND LOGO + NAME: top-left corner (y ~${Math.round(height * 0.05)})
      ${params.brandLogo ? `- Place the brand logo image (href="${IMG_PLACEHOLDER_LOGO}") at x=${Math.round(width * 0.03)}, y=${Math.round(height * 0.02)}, width=${actualLogoSize}, height=${actualLogoSize}
      - THIS LOGO MUST BE LARGE AND PROMINENT — ${actualLogoSize}px minimum (about ${Math.round(actualLogoSize / Math.min(width, height) * 100)}% of canvas)
      - The logo is a key branding element — make it clearly visible, not tiny${brandNameDisplay ? `
      - Place brand name "${brandNameDisplay}" text RIGHT NEXT to the logo (to its right), vertically centered with the logo` : `
      - (Logo only — no brand name text needed, the logo already contains it)`}` : brandNameDisplay ? `- Brand name "${brandNameDisplay}" as text` : `- (No brand display in this design)`}
      ${brandNameDisplay ? `- Font-size ${sBrand}px, font-weight 700, dark color` : ""}

   b. HEADLINE: Very large, font-size ${sHeadline}px, font-weight 700, color #1a1a1a or dark brand color
      - Position below brand: y ~${Math.round(height * 0.20)}
      - *** MAX WIDTH: ${Math.round(width * (isTextOnlyDesign ? 0.80 : 0.36))}px — text MUST wrap to multiple lines, NOT extend past x=${textMaxX} ***
      - MUST be ${isTextOnlyDesign ? "3-5" : "2-4"} lines to fill space — break into multiple lines using <tspan> elements
      - Line-height 1.15, use <tspan> elements for each line with dy attribute
      - This is the MAIN visual text — make it BOLD, LARGE, and IMPACTFUL
      ${isTextOnlyDesign ? "- TEXT-ONLY MODE: Write more compelling copy since there's no hero image. Include more detail, benefits, or emotional language." : ""}
      - The headline should span approximately ${Math.round(height * 0.20)} to ${Math.round(height * (isTextOnlyDesign ? 0.50 : 0.42))} vertically
      ${isTextOnlyDesign ? "" : `- NEVER let headline text go past x=${textMaxX} — it will overlap the product/hero!`}

   c. SUBTITLE: Below headline, font-size ${sSubtitle}px, font-weight 400, color #555 or gray
      - Position: y ~${Math.round(height * (isTextOnlyDesign ? 0.55 : 0.48))}
      - MAX WIDTH: ${Math.round(width * (isTextOnlyDesign ? 0.80 : 0.36))}px — wrap to 2-3 lines if needed, do NOT exceed x=${textMaxX}
      - ${isTextOnlyDesign ? "2-3 lines of detailed supporting text — expand on the headline with more context" : "1-2 lines of supporting/explanatory text that adds value"}

   d. BODY/BULLET POINTS: Add ${isTextOnlyDesign ? "4-5" : "2-3"} key benefits or features, font-size ${sBody}px
      - Position: y ~${Math.round(height * (isTextOnlyDesign ? 0.62 : 0.56))} to ${Math.round(height * (isTextOnlyDesign ? 0.80 : 0.68))}
      - Use bullet points (• ) or check marks (✓) for each point
      - ${isTextOnlyDesign ? "TEXT-ONLY MODE: Add MORE bullet points with detailed benefits. Example:\n        • Detailed benefit one with explanation\n        • Another compelling feature point\n        • Third advantage to highlight\n        • Additional value proposition\n        • Final convincing point" : "Example: \"• Feature one\" / \"• Feature two\" / \"• Feature three\""}
      - This helps FILL the vertical space and adds substance to the ad

   e. CTA BUTTON: Below text block
      - Position: y ~${Math.round(height * 0.75)}
      - Button width: ~${Math.round(width * 0.25)}px
      - Rounded rectangle (rx=${Math.round(sHeadline * 0.35)}) with brand primary color fill
      - Button x position: ${Math.round(width * 0.04)}
      - TEXT MUST BE CENTERED using text-anchor="middle":
        <text x="${Math.round(width * 0.04 + (width * 0.25) / 2)}" y="..." text-anchor="middle" dominant-baseline="central" font-size="${sCta}" font-weight="700" fill="white">CTA Text</text>
      - The text x is the CENTER of the button, not the left edge
      - Add subtle drop shadow to the button rect
${contactInfo && (contactInfo.email || contactInfo.phone || contactInfo.website || contactInfo.address) ? `
   f. CONTACT INFO — MANDATORY (below CTA, naturally integrated into the left-side design):
      - Position below the CTA button: y ~${Math.round(height * 0.88)}
      - Style to match the overall design — use the design's text color palette (NOT hardcoded gray)
      - Font-size ${sContact}px, font-weight 500
      - Each item on its own <text> line, with ${Math.round(sContact * 1.8)}px line spacing
      - Contact items to include (ALL are REQUIRED):
${contactInfo.website ? `        "${contactInfo.website}"\n` : ""}${contactInfo.email ? `        "${contactInfo.email}"\n` : ""}${contactInfo.phone ? `        "${contactInfo.phone}"\n` : ""}${contactInfo.address ? `        "${contactInfo.address}"\n` : ""}      - MUST include every item above — do NOT skip any
` : ""}${socialHandlesSection}

7. ENGAGEMENT BADGES (create as SVG, not images):
   - Small rounded rectangles (55-70px wide, 28px tall) with:
     - A heart or like icon (SVG path or ❤ character)
     - A number like "250" or "1.2k"
     - Colors: orange (#FF6B35), red (#FF3B30), blue (#007AFF)
   - SAFE PLACEMENT ZONES ONLY:
${isTextOnlyDesign ? `     * Top corners: x=${Math.round(width * 0.02)}-${Math.round(width * 0.12)}, y=${Math.round(height * 0.02)}-${Math.round(height * 0.10)} OR x=${Math.round(width * 0.88)}-${Math.round(width * 0.98)}, y=${Math.round(height * 0.02)}-${Math.round(height * 0.10)}
     * Right edge: x=${Math.round(width * 0.88)}-${Math.round(width * 0.98)}, y=${Math.round(height * 0.35)}-${Math.round(height * 0.65)}
   - TEXT-ONLY MODE: Place badges in corners/edges, NOT over the main text content` : `     * Gap between text and hero: x=${textMaxX}-${Math.round(width * 0.50)}, y=${Math.round(height * 0.4)}-${Math.round(height * 0.65)}
     * Bottom-right of canvas: x=${Math.round(width * 0.7)}-${Math.round(width * 0.9)}, y=${Math.round(height * 0.65)}-${Math.round(height * 0.85)}
     * Top-right edge: x=${Math.round(width * 0.78)}-${Math.round(width * 0.93)}, y=${Math.round(height * 0.12)}-${Math.round(height * 0.22)}
   - NEVER on the hero's face/head area (y < ${Math.round(height * 0.35)} near center-right)
   - NEVER over text content area (x < ${textMaxX})`}
   - Apply light shadow

8. ACCENT DOTS/SHAPES:
   - Small circles (8-12px) in brand colors scattered for visual rhythm
   - Thin horizontal line separators between text sections`}

SVG RULES:
1. Output ONLY the SVG code: <svg ... > ... </svg>
2. viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
3. Use <defs> for: drop-shadow filter, gradients
4. <g> groups for logical sections
5. Font: Arial, Helvetica — web-safe sans-serif only
6. No JavaScript, no <script>, no event handlers
7. Use EXACT placeholder tokens as image href values
8. BUTTON TEXT CENTERING: Always use text-anchor="middle" and position text at the CENTER x of the button rect (not left edge)
9. All text must have actual content (not "Lorem ipsum" — use real ad copy relevant to the design request)
10. *** CRITICAL TEXT BOUNDARY: ALL text (headline, subtitle, body) MUST stay within x=0 to x=${textMaxX}. ${isTextOnlyDesign ? "TEXT-ONLY MODE: Use the full width for impactful typography!" : `The hero/product occupies the RIGHT side starting at x=${Math.round(width * 0.45)} — NEVER let text overlap this area!`} ***
${contactInfo && (contactInfo.email || contactInfo.phone || contactInfo.website || contactInfo.address) ? `11. CRITICAL: Section 6f (CONTACT INFO) is MANDATORY. You MUST include the contact details as text below the CTA button. Double-check your SVG output includes every contact item listed.` : ""}`;
  } else {
    compositionPrompt = `You are an expert graphic designer at a top agency. Generate a professional social media ad using ONLY SVG elements (no external images).

DESIGN REQUEST: "${prompt}"
DIMENSIONS: ${width}x${height} pixels
VISUAL STYLE: ${style || "modern"}
${brandColorSection}

TEXT MODE: ${textModeInstruction}

OVERLAY PLAN: ${analysis.overlayPlan}

STYLE GUIDE:
${styleGuide}

*** DYNAMIC FONT SIZES (calculated for ${width}x${height} canvas): ***
- Headline: ${sHeadline}px (bold, dark color) — MUST be multi-line (2-4 lines)
- Subtitle: ${sSubtitle}px (regular weight, gray)
- Brand name: ${sBrand}px (bold)
- CTA button text: ${sCta}px (bold, white on brand color)
- Body/bullet points: ${sBody}px
- Contact info: ${sContact}px

Create a professional ad design following this pattern — FILL THE CANVAS with content:
- Clean gradient background (light colors: cream, white, soft pastels)
${brandNameDisplay ? `- BRAND NAME "${brandNameDisplay}" at top-left: font-size ${sBrand}px, y ~${Math.round(height * 0.06)}` : "- (No brand name display - skip this element)"}
- HEADLINE (main text): font-size ${sHeadline}px, positioned LEFT, y ~${Math.round(height * 0.20)} to ${Math.round(height * 0.42)}
  * MUST be 2-4 lines using <tspan> elements to fill space
  * This should be the dominant text element
- SUBTITLE below headline: font-size ${sSubtitle}px, y ~${Math.round(height * 0.48)}
- BULLET POINTS (2-3 benefits): font-size ${sBody}px, y ~${Math.round(height * 0.56)} to ${Math.round(height * 0.68)}
  * Add "• Feature one" / "• Feature two" / "• Feature three" style points
- CTA BUTTON with rounded corners: text ${sCta}px, y ~${Math.round(height * 0.75)}
- 2-3 large decorative circles/blobs in brand colors at 15-25% opacity
- Small SVG social media icon badges (rounded squares with simple shapes)
- Engagement notification badges (small rounded rects with heart + number)
- Font: Arial/Helvetica, weight 700 for headlines, 400 for body
- The design should look like a professional Instagram ad
- USE THE FULL CANVAS — distribute content vertically across the entire ${height}px height
${socialHandlesSection}

RULES:
1. Output ONLY the SVG code: <svg ... > ... </svg>
2. viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
3. Use <defs> for gradients and filters
4. Web-safe fonts only: Arial, Helvetica
5. No JavaScript, no <script>, no event handlers
6. Use actual ad copy relevant to the design request (not placeholder text)`;
  }

  // Generate the SVG composition
  const svgContent = await ai.generate(compositionPrompt, {
    maxTokens: 8192,
    temperature: 0.7,
    systemPrompt: "You are a world-class graphic designer who creates stunning SVG designs. You output ONLY valid SVG code with no explanations, no markdown code blocks, no extra text. Just the raw SVG starting with <svg and ending with </svg>.",
  });

  const svgMatch = svgContent.match(/<svg[\s\S]*<\/svg>/i);
  let cleanSvg = svgMatch ? svgMatch[0] : null;

  if (!cleanSvg) {
    throw new Error("Failed to generate valid SVG design. Please try again.");
  }

  // ── STEP 4a: Post-process hero image for wide banners (BEFORE placeholder replacement) ──
  // Must happen before replacement so we match the short placeholder, not the huge base64 string
  if (isWideBanner) {
    const heroEl = elementImages.find(e => e.role === "person" || e.role === "product");
    if (heroEl) {
      const heroPlaceholder = IMG_PLACEHOLDER_EL(heroEl.id);
      const heroW = Math.round(height * 1.4);
      const heroX = width - heroW;
      // Find any <image> tag that references this hero's placeholder and fix its attributes
      const heroImgRegex = new RegExp(
        `<image[^>]*href="${escapeRegex(heroPlaceholder)}"[^>]*/>`,
        "g"
      );
      // Use xMaxYMid meet to center person vertically (avoids head cutting)
      cleanSvg = cleanSvg.replace(heroImgRegex,
        `<image href="${heroPlaceholder}" x="${heroX}" y="0" width="${heroW}" height="${height}" preserveAspectRatio="xMaxYMid meet"/>`
      );
    }
  }

  // ── STEP 4b: Replace placeholders with base64 data URIs ──
  // Using simple string replacement instead of regex to avoid stack overflow with large base64 strings

  // First, remove any logo placeholder Claude placed (we'll add it at the very end for top layer)
  let logoDataUri: string | null = null;
  if (params.brandLogo) {
    try {
      logoDataUri = await getLogoAsDataUri(params.brandLogo);
      // Remove the placeholder wherever Claude placed it - we'll add the logo at the END
      cleanSvg = replaceAllSimple(cleanSvg, IMG_PLACEHOLDER_LOGO, "");
      console.log("[Visual] Brand logo will be injected as top layer");
    } catch (logoErr) {
      console.error("[Visual] Failed to convert logo to data URI:", logoErr);
      cleanSvg = replaceAllSimple(cleanSvg, IMG_PLACEHOLDER_LOGO, "");
    }
  }

  if (backgroundBase64) {
    cleanSvg = replaceAllSimple(cleanSvg, IMG_PLACEHOLDER_BG, `data:image/png;base64,${backgroundBase64}`);
  }

  for (const el of elementImages) {
    const placeholder = IMG_PLACEHOLDER_EL(el.id);
    cleanSvg = replaceAllSimple(cleanSvg, placeholder, `data:image/png;base64,${el.base64}`);
  }

  // ── STEP 4b2: Inject logo at VERY END of SVG (top layer) ──
  // This ensures the logo is ALWAYS on top of all other elements
  if (logoDataUri && params.brandLogo) {
    // Use the appropriate logo size based on layout type
    const logoSize = isWideBanner || isTallBanner ? bLogo : sLogo;
    // Position: closer to top-left corner (2% from left, 1.5% from top)
    const logoX = Math.round(width * 0.02);
    const logoY = Math.round(height * 0.015);

    // Create the logo image element
    const logoElement = `<image href="${logoDataUri}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;

    // Insert logo just before closing </svg> tag to ensure it's the TOP layer
    cleanSvg = cleanSvg.replace(/<\/svg>\s*$/, `${logoElement}</svg>`);
    console.log(`[Visual] Logo injected at top layer: ${logoSize}px at (${logoX}, ${logoY})`);
  }

  // ── STEP 4c: Post-process CTA button for wide banners (after placeholder replacement) ──
  if (isWideBanner) {
    // Fix CTA button rect: find small rects with rounded corners and ensure minimum width
    const minCtaWidth = Math.round(width * 0.28);
    cleanSvg = cleanSvg.replace(
      /<rect([^>]*?)width="(\d+(?:\.\d+)?)"([^>]*?)rx="(\d+(?:\.\d+)?)"([^>]*?)\/>/g,
      (match, before, w, mid, rx, after) => {
        const rectWidth = parseFloat(w);
        const roundRadius = parseFloat(rx);
        // Identify CTA button rects: has rx (rounded corners) and is narrower than expected
        if (roundRadius >= 6 && rectWidth < minCtaWidth && rectWidth > 20) {
          return `<rect${before}width="${minCtaWidth}"${mid}rx="${rx}"${after}/>`;
        }
        return match;
      }
    );
  }

  const sanitizedSvg = sanitizeSvg(cleanSvg);
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(sanitizedSvg).toString("base64")}`;

  return {
    imageUrl: svgDataUri,
    svgContent: sanitizedSvg,
    pipeline: (totalImagesGenerated > 0 ? "hybrid" : "svg-only") as "hybrid" | "svg-only",
    model: totalImagesGenerated > 0 ? "claude-sonnet-4+gpt-image-1" : "claude-sonnet-4-20250514",
    promptUsed: analysisPrompt + compositionPrompt,
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace all occurrences of a placeholder with a value using simple string operations.
 * This is more memory-efficient than regex for large replacement values (like base64 images).
 */
function replaceAllSimple(str: string, placeholder: string, replacement: string): string {
  let result = str;
  let index = result.indexOf(placeholder);

  while (index !== -1) {
    result = result.substring(0, index) + replacement + result.substring(index + placeholder.length);
    // Search from after the replacement to avoid infinite loops
    index = result.indexOf(placeholder, index + replacement.length);
  }

  return result;
}

function sanitizeSvg(svg: string): string {
  let clean = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, "");
  clean = clean.replace(/href\s*=\s*["']data:(?!image\/)[^"']*["']/gi, "");
  return clean;
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

function getStyleGuide(style: string): string {
  const guides: Record<string, string> = {
    photorealistic: "Semi-transparent dark/light overlay panels behind text. Clean sans-serif (Arial/Helvetica). Subtle drop shadows. Rounded corners on panels. Brand colors for accents.",
    illustration: "Bold, colorful overlay panels with solid backgrounds. Playful typography. Rounded shapes. Fun decorative elements.",
    minimalist: "Minimal overlay — just text with subtle text-shadow or thin strip. Max 2-3 colors. Light-weight sans-serif. Lots of breathing room.",
    modern: "Gradient overlay panels (semi-transparent). Bold headlines with geometric shapes. Vibrant CTAs. Grid-based layout.",
    vintage: "Cream/parchment overlay panels. Serif typography with ornamental details. Decorative borders. Warm muted accents.",
    abstract: "Bold, unexpected color overlay panels. Experimental typography. Geometric accent shapes. Strong contrasts.",
    flat: "Solid color panels (no gradients/shadows). Clean sans-serif. Bright accent colors. Simple geometric shapes.",
    "3d": "Glossy layered panels with shadows. Bold typography with 3D offset shadow effect. Gradient accents.",
    watercolor: "Soft semi-transparent white/cream overlay. Elegant serif or script typography. Pastel accents. Organic shapes.",
    neon: "Dark semi-transparent panels. Neon text with glow effects (SVG filter). Electric accent colors. Bold sans-serif.",
  };
  return guides[style] || guides.modern;
}
