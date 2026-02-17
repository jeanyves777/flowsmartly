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
  provider: ImageProvider;
}

async function runDirectPipeline(params: PipelineParams) {
  const {
    prompt, category, width, height, style,
    brandColors, heroType, textMode,
    brandName, contactInfo,
    showBrandName = true, showSocialIcons, socialHandles,
    provider,
  } = params;

  const styleDesc = getPhotoStyleDirection(style || "modern");

  // Build the comprehensive prompt
  let designPrompt = `Create a professional ${category.replace("_", " ")} design.

CRITICAL — OUTPUT FORMAT:
- The generated image IS the final design itself — it must fill the ENTIRE canvas edge-to-edge
- Do NOT render the design inside a phone screen, browser window, mockup frame, or any other container
- Do NOT place the design on a desk, table, or any surface as if it were a printed piece
- Do NOT add any border, shadow, or margin around the design — the design goes right to every edge
- The image you generate is the ACTUAL deliverable, not a preview or presentation of it

VISUAL STYLE: ${style || "modern"} — ${styleDesc}

LAYOUT:
- Professional ${category.replace("_", " ")} layout filling the entire canvas
- Clean background (soft gradient or subtle texture) extending to all edges
- Text content on the LEFT side (40–50% of width)
- Bold headline, subtitle, and a prominent CTA button
- USE THE FULL CANVAS — the design must bleed to every edge with no margin or frame`;

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
- This IS the final design — NOT a mockup, NOT inside a frame/phone/browser. The image fills the canvas edge-to-edge.
- All text must be perfectly readable and spelled correctly
- Clean, modern typography (sans-serif)
- Do NOT include any watermarks or AI-related text
- Do NOT render the design on a background or inside any container — the design IS the full image
- The design must bleed to all 4 edges with no margin, border, or shadow around it${hasLogo ? "\n- KEEP THE TOP-LEFT CORNER CLEAR — no text or icons there (logo will be added separately)" : ""}`;

  // ── Generate image via selected provider ──

  let base64: string | null;
  let model: string;

  switch (provider) {
    case "openai": {
      const gptSize = getGptImageSize(width, height);
      console.log(`[Visual] OpenAI gpt-image-1 @ ${gptSize}${params.templateImageUrl ? " (with template)" : ""}`);

      if (params.templateImageUrl) {
        const templatePath = path.join(process.cwd(), "public", params.templateImageUrl);
        const templateBuffer = await readFile(templatePath);
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
      model = "gpt-image-1";
      break;
    }

    case "xai": {
      const aspectRatio = sizeToAspectRatio(width, height);
      console.log(`[Visual] xAI grok-imagine-image @ ${aspectRatio}`);

      if (!xaiClient.isAvailable()) {
        throw new Error("xAI provider is not configured. Please set XAI_API_KEY.");
      }
      base64 = await xaiClient.generateImage(designPrompt, { aspectRatio });
      model = "grok-imagine-image";
      break;
    }

    case "gemini": {
      const aspectRatio = sizeToAspectRatioGemini(width, height);
      console.log(`[Visual] Gemini imagen-4 @ ${aspectRatio}`);

      if (!geminiImageClient.isAvailable()) {
        throw new Error("Gemini provider is not configured. Please set GEMINI_API_KEY.");
      }
      base64 = await geminiImageClient.generateImage(designPrompt, { aspectRatio });
      model = "imagen-4.0-generate-001";
      break;
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  if (!base64) {
    throw new Error("Failed to generate design image. Please try again.");
  }

  // ── Upscale to target dimensions ──

  let finalBase64 = base64;
  let finalW = width;
  let finalH = height;

  try {
    const inputBuffer = Buffer.from(finalBase64, "base64");
    const meta = await sharp(inputBuffer).metadata();
    const srcW = meta.width || 1024;
    const srcH = meta.height || 1024;

    if (width !== srcW || height !== srcH) {
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
      console.log(`[Visual] Resized from ${srcW}x${srcH} to ${width}x${height}`);
    }
  } catch (upErr) {
    console.warn("[Visual] Resize failed, using original resolution:", upErr);
  }

  // ── Composite brand logo (top-left, TOP layer) ──

  if (hasLogo && params.brandLogo) {
    try {
      console.log(`[Visual] Compositing logo on ${finalW}x${finalH} canvas...`);
      finalBase64 = await compositeLogo(finalBase64, params.brandLogo, `${finalW}x${finalH}`);
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
// LOGO COMPOSITING — sharp-based overlay
// ═══════════════════════════════════════════════════════════════

async function compositeLogo(
  imageBase64: string,
  logoSource: string,
  targetSize: string
): Promise<string> {
  const [imgW, imgH] = targetSize.split("x").map(Number);
  const smallerDim = Math.min(imgW, imgH);

  // Dynamic logo size: 18% of smaller dimension, 120–300px
  const logoSize = Math.max(120, Math.min(Math.round(smallerDim * 0.18), 300));
  const logoX = Math.round(imgW * 0.02);
  const logoY = Math.round(imgH * 0.015);

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
