import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { openaiClient } from "@/lib/ai/openai-client";
import { saveLogoImage } from "@/lib/utils/file-storage";
import { getDynamicCreditCost, DEFAULT_CREDIT_COSTS, checkCreditsForFeature } from "@/lib/credits/costs";
import { presignAllUrls } from "@/lib/utils/s3-client";

// Logo style variations for the 3 concepts
const LOGO_VARIATIONS = [
  {
    label: "Modern",
    variation: "modern",
    styleHint: "Clean, minimalist, modern design with bold shapes and negative space",
  },
  {
    label: "Creative",
    variation: "creative",
    styleHint: "Creative, artistic interpretation with unique visual elements and dynamic composition",
  },
  {
    label: "Classic",
    variation: "classic",
    styleHint: "Timeless, professional, elegant design with balanced proportions and refined details",
  },
];

// POST /api/ai/logo - Generate 3 logo concepts using gpt-image-1
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "AI logo generation");
    if (gate) return gate;

    // Get dynamic credit cost from database
    const LOGO_CREDITS = await getDynamicCreditCost("AI_LOGO_GENERATION");

    const body = await request.json();
    const { brandName, tagline, industry, style, logoType, showSubtitle, colors, additionalNotes } = body;

    if (!brandName) {
      return NextResponse.json(
        { success: false, error: { message: "Brand name is required" } },
        { status: 400 }
      );
    }

    const isAdmin = !!session.adminId;
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_LOGO_GENERATION", isAdmin);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    // Generate all 3 logos in parallel using gpt-image-1 with transparent backgrounds
    const logoResults = await Promise.allSettled(
      LOGO_VARIATIONS.map(async (variation) => {
        const prompt = buildLogoPrompt({
          brandName,
          tagline: showSubtitle ? tagline : undefined,
          industry,
          style: style || "combination",
          logoType: logoType || "nameWithIcon",
          showSubtitle: !!showSubtitle,
          colors,
          additionalNotes,
          styleHint: variation.styleHint,
        });

        const base64 = await openaiClient.generateImage(prompt, {
          size: "1024x1024",
          quality: "high",
          transparent: true,
        });

        if (!base64) throw new Error(`Failed to generate ${variation.label} logo`);

        const dataUri = `data:image/png;base64,${base64}`;

        // Create design record
        const design = await prisma.design.create({
          data: {
            userId: session.userId,
            prompt: `Logo for ${brandName} - ${variation.label}`,
            category: "logo",
            size: "1024x1024",
            style: style || "combination",
            status: "COMPLETED",
            imageUrl: "", // Will be updated after file save
            metadata: JSON.stringify({
              brandName,
              tagline: showSubtitle ? tagline : null,
              industry,
              logoType: logoType || "nameWithIcon",
              showSubtitle: !!showSubtitle,
              colors,
              additionalNotes,
              variation: variation.variation,
              label: variation.label,
              format: "png",
              transparent: true,
            }),
          },
        });

        // Save PNG to disk
        const fileUrl = await saveLogoImage(dataUri, design.id, "png");
        await prisma.design.update({
          where: { id: design.id },
          data: { imageUrl: fileUrl },
        });

        return {
          id: design.id,
          label: variation.label,
          variation: variation.label,
          style: style || "combination",
          imageUrl: fileUrl,
        };
      })
    );

    const logos = logoResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<{
        id: string;
        label: string;
        variation: string;
        style: string;
        imageUrl: string;
      }>).value);

    if (logos.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "All logo generations failed. Please try again." } },
        { status: 500 }
      );
    }

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
          data: { aiCredits: { decrement: LOGO_CREDITS } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -LOGO_CREDITS,
            balanceAfter: (currentUser?.aiCredits || 0) - LOGO_CREDITS,
            referenceType: "ai_logo",
            referenceId: logos[0].id,
            description: `Logo generation: ${brandName} (${logos.length} concepts)`,
          },
        }),
      ]);
    }

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "logo_generation",
        model: "gpt-image-1",
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    // Save to media library
    for (const logo of logos) {
      await prisma.mediaFile.create({
        data: {
          userId: session.userId,
          filename: `logo-${logo.id}.png`,
          originalName: `${brandName} Logo - ${logo.label}.png`,
          url: logo.imageUrl,
          type: "png",
          mimeType: "image/png",
          size: 0, // Size unknown for generated images
          width: 1024,
          height: 1024,
          tags: JSON.stringify(["logo", "ai-generated", "transparent"]),
          metadata: JSON.stringify({ designId: logo.id, variation: logo.variation }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        logos,
        creditsUsed: isAdmin ? 0 : LOGO_CREDITS,
        creditsRemaining: isAdmin ? 999 : (currentUser?.aiCredits || 0) - LOGO_CREDITS,
      }),
    });
  } catch (error) {
    console.error("Logo generation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate logos" } },
      { status: 500 }
    );
  }
}

// Build the prompt for gpt-image-1 logo generation
function buildLogoPrompt(params: {
  brandName: string;
  tagline?: string;
  industry?: string;
  style: string;
  logoType: "nameOnly" | "nameWithIcon" | "nameInIcon";
  showSubtitle: boolean;
  colors?: { primary?: string; secondary?: string; accent?: string };
  additionalNotes?: string;
  styleHint: string;
}): string {
  const { brandName, tagline, industry, style, logoType, showSubtitle, colors, additionalNotes, styleHint } = params;

  const colorDesc = colors
    ? `Use these brand colors: primary ${colors.primary || "#000"}, secondary ${colors.secondary || "#666"}, accent ${colors.accent || "#06F"}.`
    : "Use professional, harmonious colors.";

  const styleGuide = getLogoStyleGuide(style);
  const logoTypeGuide = getLogoTypeGuide(logoType);
  const subtitleGuide = showSubtitle && tagline
    ? `Include the subtitle/tagline "${tagline}" below the brand name in a smaller, complementary font.`
    : "Do NOT include any subtitle or tagline - only the brand name.";

  return `Create a professional ${style} logo for the brand "${brandName}".

BRAND INFORMATION:
- Brand name: ${brandName}
${showSubtitle && tagline ? `- Subtitle/Tagline: "${tagline}"` : ""}
${industry ? `- Industry: ${industry}` : ""}

LOGO TYPE:
${logoTypeGuide}

SUBTITLE REQUIREMENT:
${subtitleGuide}

DESIGN DIRECTION: ${styleHint}

STYLE REQUIREMENTS:
${styleGuide}

COLOR PALETTE:
${colorDesc}

${additionalNotes ? `ADDITIONAL REQUIREMENTS: ${additionalNotes}` : ""}

CRITICAL REQUIREMENTS:
- Create a clean, professional logo with TRANSPARENT background (no background at all)
- The brand name "${brandName}" must be clearly visible and readable
- Sharp, crisp edges suitable for both digital and print
- **IMPORTANT: The logo must FILL at least 80-90% of the canvas** - minimize empty padding around the logo
- The logo should extend close to the edges of the image, not be tiny in the center
- NO watermarks, NO mockup backgrounds, NO templates
- ONLY the logo itself on transparent background
- High quality, production-ready design
- Must work well on both light and dark backgrounds
- **SCALE: Make the logo LARGE and fill the frame** - do not leave excessive transparent margins`;
}

function getLogoTypeGuide(logoType: string): string {
  const guides: Record<string, string> = {
    nameOnly: "Create a TEXT-ONLY logo (wordmark style). The brand name is the entire logo - no icons, no symbols, no graphics. Focus entirely on elegant, distinctive typography that makes the text itself memorable. Think Google, FedEx, or Coca-Cola.",
    nameWithIcon: "Create a COMBINATION logo with the brand name text PLUS a separate icon/symbol placed beside it (left, right, or above). The icon should be distinct but complementary to the text. Think Adidas, Spotify, or Slack.",
    nameInIcon: "Create an EMBLEM/INTEGRATED logo where the brand name is INSIDE or PART OF a shape, badge, crest, or icon. The text and graphic are unified into one cohesive mark. Think Starbucks, BMW, or NFL team logos.",
  };
  return guides[logoType] || guides.nameWithIcon;
}

function getLogoStyleGuide(style: string): string {
  const guides: Record<string, string> = {
    wordmark: "Focus on elegant, custom typography. The text IS the logo. Think Google, FedEx, or Coca-Cola.",
    lettermark: "Use the brand initials with distinctive, stylized letterforms. Think IBM, HP, or CNN.",
    icon: "Create a bold, memorable symbol/icon alongside the brand name. Think Apple, Twitter, or Nike.",
    combination: "Combine a distinctive icon with the brand name text. Think Adidas, Burger King, or Doritos.",
    emblem: "Place the brand name within a badge, crest, or contained shape. Think Starbucks or Harley-Davidson.",
    abstract: "Use abstract geometric forms to create a unique, modern mark. Think Pepsi, Chase, or Airbnb.",
    mascot: "Include a simple, stylized character or mascot element. Think Mailchimp, KFC, or Pringles.",
  };
  return guides[style] || guides.combination;
}
