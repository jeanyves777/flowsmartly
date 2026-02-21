import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { openaiClient } from "@/lib/ai/openai-client";
import { xaiClient, sizeToAspectRatio } from "@/lib/ai/xai-client";
import { geminiImageClient, sizeToAspectRatioGemini } from "@/lib/ai/gemini-image-client";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { saveDesignImage } from "@/lib/utils/file-storage";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { presignAllUrls } from "@/lib/utils/s3-client";
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

function getGptImageSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const aspectRatio = width / height;
  if (aspectRatio > 1.3) return "1536x1024";
  if (aspectRatio < 0.77) return "1024x1536";
  return "1024x1024";
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
    const {
      prompt, category, size, style,
      brandColors, heroType, textMode,
      brandLogo, brandName, contactInfo,
      showBrandName, showSocialIcons, socialHandles,
      templateImageUrl,
      referenceImageUrl,
      logoSizePercent,
      ctaText,
      editImageUrl,
      provider,
    } = body;

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
    const selectedProvider: ImageProvider = provider || "openai";
    console.log(`[Visual] Provider: ${selectedProvider} for ${width}x${height} (ratio ${(width / height).toFixed(2)})`);

    // Generate the design
    const result = await runDirectPipeline({
      prompt, category, width, height, style,
      brandColors, heroType, textMode,
      brandLogo, brandName, contactInfo,
      showBrandName, showSocialIcons, socialHandles,
      templateImageUrl,
      referenceImageUrl,
      logoSizePercent: logoSizePercent || null,
      ctaText: ctaText || null,
      editImageUrl: editImageUrl || null,
      provider: selectedProvider,
    });

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
          pipeline: "direct",
          provider: selectedProvider,
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
          pipeline: "direct",
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
  logoSizePercent?: number | null;
  ctaText?: string | null;
  editImageUrl?: string | null;
  provider: ImageProvider;
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
    formatDesc = `a WIDE HORIZONTAL BANNER (${width}×${height}px, ~${ratio.toFixed(1)}:1 ratio). This is a landscape banner — arrange content horizontally with ample width`;
  } else if (ratio > 1.2) {
    formatDesc = `a LANDSCAPE rectangle (${width}×${height}px, ~${ratio.toFixed(1)}:1 ratio). Slightly wider than tall — balance content across the width`;
  } else if (ratio > 0.85) {
    formatDesc = `a SQUARE format (${width}×${height}px). Equal width and height — center the composition`;
  } else if (ratio > 0.6) {
    formatDesc = `a PORTRAIT rectangle (${width}×${height}px). Taller than wide — stack content vertically`;
  } else {
    formatDesc = `a TALL VERTICAL format (${width}×${height}px, ~1:${(1 / ratio).toFixed(1)} ratio). Very tall and narrow — use strong vertical layout`;
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
- CTA BUTTON: Rounded or pill-shaped button with bold contrasting color. Text inside should be uppercase, semi-bold, with letter-spacing. Add a subtle shadow or glow to make it pop. Place it further below the subtitle with clear spacing.
- SPACING HIERARCHY: headline → (large gap) → subtitle → (medium gap) → CTA button. Each element must have distinct breathing room. Never stack text elements tightly together.
- Ensure strong contrast between text and background — if the background is busy, add a semi-transparent overlay, gradient fade, or text shadow behind the text area so every word is crisp and readable.
- Use consistent alignment (left-align or center-align all text elements together, never mix).
- Text should NEVER overlap the hero image awkwardly — keep text in its own clear zone with breathing room.
- All text must be pixel-perfect: no cut-off letters, no words bleeding off the edge, no overlapping lines.`;

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
    designPrompt += `\n- **TOP-LEFT EXCLUSION ZONE** (VERY IMPORTANT): The top-left corner is RESERVED — a brand logo will be composited there after generation. You MUST keep the top-left area (roughly 15% width × 15% height from the top-left corner) completely CLEAR of any text, headlines, icons, buttons, or important visual elements. Only background color/gradient should be in that zone. Do NOT put ANY text there — no brand name, no headline, no tagline, nothing.`;

    if (showBrandName && brandName) {
      const logoHasName = await logoContainsBrandName(params.brandLogo!, brandName);
      if (!logoHasName) {
        designPrompt += `\n- Brand name: "${brandName}" — display it in the top-center or top-right area, NEVER in the top-left corner`;
      }
    }
  } else if (showBrandName && brandName) {
    designPrompt += `\n- Brand name: "${brandName}" — display prominently in the top-left corner`;
  }

  // Social media handles
  if (showSocialIcons && socialHandles && Object.keys(socialHandles).length > 0) {
    const socialIconSize = Math.max(24, Math.min(Math.round(Math.sqrt(width * height) / 30), 60));
    const socialTextSize = Math.max(12, Math.min(Math.round(Math.sqrt(width * height) / 50), 28));
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
  const ctaInstruction = params.ctaText
    ? `Use this EXACT call-to-action text on the CTA button: "${params.ctaText}"`
    : `Add a short CTA button like "Learn More" or "Get Started".`;

  if (textMode === "exact") {
    designPrompt += `\n\nTEXT CONTENT — USE THIS EXACT TEXT on the design (do not change the wording, do not rephrase):
"${prompt}"
Display this text as the headline/main text. ${ctaInstruction}`;
  } else {
    designPrompt += `\n\nTEXT CONTENT — Create compelling ad copy based on this topic/description:
"${prompt}"
Generate a bold headline (2-4 words max per line) and a short subtitle. ${ctaInstruction}`;
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
- This IS the final design — NOT a mockup, NOT inside a frame/phone/browser. The image fills the canvas edge-to-edge.
- TYPOGRAPHY QUALITY: Every word must be perfectly spelled, fully visible, and razor-sharp. Use a premium sans-serif typeface. Headlines should have dramatic size contrast with body text. The text layout should look like it was done by a professional graphic designer — balanced, aligned, and beautifully spaced.
- TEXT READABILITY: If text sits on a photo or complex background, you MUST ensure contrast — use a dark overlay behind light text, or a light overlay behind dark text, or add a strong drop shadow. No text should ever be hard to read.
- Do NOT include any watermarks or AI-related text
- Do NOT render the design on a background or inside any container — the design IS the full image
- The design must bleed to all 4 edges with no margin, border, or shadow around it${hasLogo ? "\n- KEEP THE TOP-LEFT CORNER CLEAR — no text or icons there (logo will be added separately)" : ""}`;

  // ── Resolve reference image (if any) ──

  const refUrl = params.referenceImageUrl || params.templateImageUrl;
  let refBuffer: Buffer | null = null;
  if (refUrl) {
    refBuffer = await resolveImageToBuffer(refUrl);
  }

  const refPrompt = refBuffer
    ? params.referenceImageUrl
      ? `ABSOLUTE REQUIREMENT — READ THIS FIRST:\nThe attached image is a REAL photograph/image provided by the user. You MUST use the EXACT subject/content from this image as the main hero visual in the design — preserve every detail of the subject (person, product, object, logo) exactly as it appears: same pose, same colors, same features, same proportions. Do NOT redraw, recreate, or generate a similar-looking version of the subject.\n\nHowever, you MUST naturally BLEND and INTEGRATE the subject into the design's background. Remove or replace the image's original background and seamlessly composite the subject into the new design environment. The subject should look like it naturally belongs in the scene — with proper lighting, shadows, color grading, and perspective that match the overall design. Do NOT simply paste the image on top with a visible rectangular boundary or its own separate background. The integration should be seamless and professional, as if the subject was photographed specifically for this design.\n\n${designPrompt}`
      : `IMPORTANT: Use the provided image as a DESIGN TEMPLATE REFERENCE. Recreate a very similar design following the same layout, composition, visual style, color scheme, and arrangement of elements — but customize it with the specific content, branding, and details described below.\n\n${designPrompt}`
    : null;

  // ── Generate image via selected provider ──

  let base64: string | null;
  let model: string;
  const hasRef = !!refBuffer;

  switch (provider) {
    case "openai": {
      const gptSize = getGptImageSize(width, height);
      console.log(`[Visual] OpenAI gpt-image-1 @ ${gptSize}${hasRef ? " (with reference)" : ""}`);

      if (refBuffer) {
        base64 = await openaiClient.editImage(refPrompt!, refBuffer, {
          size: gptSize,
          quality: "high",
        });
      } else {
        base64 = await openaiClient.generateImage(designPrompt, {
          size: gptSize,
          quality: "high",
        });
      }
      model = "gpt-image-1";
      break;
    }

    case "xai": {
      const aspectRatio = sizeToAspectRatio(width, height);
      console.log(`[Visual] xAI grok-imagine-image @ ${aspectRatio}${hasRef ? " (with reference)" : ""}`);

      if (!xaiClient.isAvailable()) {
        throw new Error("xAI provider is not configured. Please set XAI_API_KEY.");
      }
      if (refBuffer) {
        const refBase64 = refBuffer.toString("base64");
        base64 = await xaiClient.editImage(refPrompt!, refBase64, { aspectRatio });
      } else {
        base64 = await xaiClient.generateImage(designPrompt, { aspectRatio });
      }
      model = "grok-imagine-image";
      break;
    }

    case "gemini": {
      const aspectRatio = sizeToAspectRatioGemini(width, height);
      console.log(`[Visual] Gemini imagen-4 @ ${aspectRatio}${hasRef ? " (with reference)" : ""}`);

      if (!geminiImageClient.isAvailable()) {
        throw new Error("Gemini provider is not configured. Please set GEMINI_API_KEY.");
      }
      if (refBuffer) {
        const refBase64 = refBuffer.toString("base64");
        base64 = await geminiImageClient.editImage(refPrompt!, refBase64, { aspectRatio });
      } else {
        base64 = await geminiImageClient.generateImage(designPrompt, { aspectRatio });
      }
      model = hasRef ? "gemini-2.5-flash" : "imagen-4.0-generate-001";
      break;
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
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

  // ── Composite brand logo (top-left, TOP layer) ──

  if (hasLogo && params.brandLogo) {
    try {
      console.log(`[Visual] Compositing logo on ${finalW}x${finalH} canvas...`);
      finalBase64 = await compositeLogo(finalBase64, params.brandLogo, `${finalW}x${finalH}`, params.logoSizePercent || undefined);
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
  const { prompt, width, height, provider, editImageUrl } = params;

  console.log(`[Visual/Edit] Provider: ${provider}, instruction: "${prompt.slice(0, 80)}"`);

  const editPrompt = `You are editing an existing graphic design image. Apply ONLY the following change and keep everything else exactly the same — same layout, same colors, same style, same background, same composition.

EDIT INSTRUCTION: ${prompt}

RULES:
- Preserve the overall design exactly as-is
- Only modify what the instruction asks for
- Keep all other text, images, shapes, and colors unchanged
- Maintain the same dimensions and aspect ratio
- The result must look like a professional design, not a rough edit`;

  // Resolve the existing design image
  const editBuffer = await resolveImageToBuffer(editImageUrl!);

  let base64: string | null;
  let model: string;

  switch (provider) {
    case "openai": {
      const gptSize = getGptImageSize(width, height);
      console.log(`[Visual/Edit] OpenAI gpt-image-1 @ ${gptSize}`);
      base64 = await openaiClient.editImage(editPrompt, editBuffer, {
        size: gptSize,
        quality: "high",
      });
      model = "gpt-image-1";
      break;
    }

    case "xai": {
      const aspectRatio = sizeToAspectRatio(width, height);
      console.log(`[Visual/Edit] xAI grok-imagine-image @ ${aspectRatio}`);
      if (!xaiClient.isAvailable()) {
        throw new Error("xAI provider is not configured.");
      }
      const refBase64 = editBuffer.toString("base64");
      base64 = await xaiClient.editImage(editPrompt, refBase64, { aspectRatio });
      model = "grok-imagine-image";
      break;
    }

    case "gemini": {
      console.log(`[Visual/Edit] Gemini gemini-2.5-flash-image`);
      if (!geminiImageClient.isAvailable()) {
        throw new Error("Gemini provider is not configured.");
      }
      const refBase64 = editBuffer.toString("base64");
      base64 = await geminiImageClient.editImage(editPrompt, refBase64);
      model = "gemini-2.5-flash";
      break;
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  if (!base64) throw new Error("Edit returned no image");

  // Composite logo if present
  let finalBase64 = base64;
  if (params.brandLogo) {
    try {
      const meta = await sharp(Buffer.from(base64, "base64")).metadata();
      const finalW = meta.width || width;
      const finalH = meta.height || height;
      console.log(`[Visual/Edit] Compositing logo on ${finalW}x${finalH}...`);
      finalBase64 = await compositeLogo(finalBase64, params.brandLogo, `${finalW}x${finalH}`, params.logoSizePercent || undefined);
    } catch (logoErr) {
      console.error("[Visual/Edit] Logo compositing failed:", logoErr);
    }
  }

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

async function compositeLogo(
  imageBase64: string,
  logoSource: string,
  targetSize: string,
  sizePercent?: number
): Promise<string> {
  const [imgW, imgH] = targetSize.split("x").map(Number);
  const smallerDim = Math.min(imgW, imgH);

  // Dynamic logo size: user-chosen % of smaller dimension (default 18%), clamped 60–500px
  const pct = (sizePercent && sizePercent >= 5 && sizePercent <= 50) ? sizePercent : 18;
  const logoSize = Math.max(60, Math.min(Math.round(smallerDim * (pct / 100)), 500));
  const logoX = Math.round(imgW * 0.02);
  const logoY = Math.round(imgH * 0.007);

  console.log(`[Visual] Logo: target=${logoSize}px at (${logoX}, ${logoY}) on ${imgW}x${imgH}`);

  // Get logo buffer
  let logoBuffer: Buffer;

  if (logoSource.startsWith("data:")) {
    const logoBase64 = logoSource.replace(/^data:image\/[^;]+;base64,/, "");
    if (!logoBase64) throw new Error("Invalid logo data URI");
    logoBuffer = Buffer.from(logoBase64, "base64");
  } else if (logoSource.startsWith("/") || logoSource.startsWith("http")) {
    if (logoSource.startsWith("/")) {
      const localPath = path.join(process.cwd(), "public", logoSource);
      logoBuffer = await readFile(localPath);
    } else {
      const response = await fetch(logoSource);
      if (!response.ok) throw new Error(`Failed to fetch logo: ${response.status}`);
      logoBuffer = Buffer.from(await response.arrayBuffer());
    }
  } else {
    throw new Error(`Unknown logo source format: ${logoSource.substring(0, 50)}...`);
  }

  // Trim transparent padding
  let trimmedLogo: Buffer;
  try {
    trimmedLogo = await sharp(logoBuffer).trim({ threshold: 10 }).png().toBuffer();
  } catch {
    trimmedLogo = logoBuffer;
  }

  // Resize to target size (maintain aspect ratio)
  const resizedLogo = await sharp(trimmedLogo)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Composite onto design
  const designBuffer = Buffer.from(imageBase64, "base64");
  const result = await sharp(designBuffer)
    .composite([{ input: resizedLogo, left: logoX, top: logoY }])
    .png()
    .toBuffer();

  return result.toString("base64");
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
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
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
