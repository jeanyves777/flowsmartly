import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { saveLogoImage } from "@/lib/utils/file-storage";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { runLogoAgent } from "@/lib/ai/logo-agent";

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

    const gate = await checkPlanAccess(session.user.plan, "AI logo generation", session.userId);
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

    // Run the logo agent — Claude orchestrates: fetches brand context,
    // picks 3 directions tuned to the brand, generates via OpenAI, evaluates
    // each with Claude vision, reruns failures (score<7) up to 2 times.
    const agentRun = await runLogoAgent({
      userId: session.userId,
      brandName,
      tagline: showSubtitle ? tagline : null,
      industry,
      style: style || "combination",
      logoType: logoType || "nameWithIcon",
      showSubtitle: !!showSubtitle,
      colors,
      additionalNotes,
    });

    // Persist each chosen logo to disk + DB
    const logos = await Promise.all(
      agentRun.logos.map(async (chosen) => {
        const cached = agentRun.ctx.images.get(chosen.handle);
        if (!cached) throw new Error(`Missing cached image for handle ${chosen.handle}`);

        const design = await prisma.design.create({
          data: {
            userId: session.userId,
            prompt: `Logo for ${brandName} - ${chosen.label}`,
            category: "logo",
            size: "1024x1024",
            style: chosen.variation,
            status: "COMPLETED",
            imageUrl: "",
            metadata: JSON.stringify({
              brandName,
              tagline: showSubtitle ? tagline : null,
              industry,
              logoType: logoType || "nameWithIcon",
              showSubtitle: !!showSubtitle,
              colors,
              additionalNotes,
              variation: chosen.variation,
              label: chosen.label,
              agentScore: chosen.score,
              format: "png",
              transparent: true,
            }),
          },
        });

        const dataUri = `data:image/png;base64,${cached.base64}`;
        const fileUrl = await saveLogoImage(dataUri, design.id, "png");
        await prisma.design.update({ where: { id: design.id }, data: { imageUrl: fileUrl } });

        return {
          id: design.id,
          label: chosen.label,
          variation: chosen.label,
          style: chosen.variation,
          imageUrl: fileUrl,
        };
      }),
    );

    if (logos.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Logo agent produced no usable concepts. Please try again." } },
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

    // Track AI usage — record agent reasoning tokens + note the image provider
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "logo_generation_agent",
        model: "claude-opus-4-7 + gpt-image-1",
        inputTokens: agentRun.usage.inputTokens,
        outputTokens: agentRun.usage.outputTokens,
        prompt: `Logo for ${brandName}`,
        response: `${logos.length} logos, ${agentRun.iterations} iter, tools: ${agentRun.toolsUsed.join(",")}`,
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

// Note: prompt-building, style guides, and logo-type guides moved into
// `src/lib/ai/logo-agent.ts` — the agent now composes prompts dynamically
// per-variation based on brand context rather than from hardcoded templates.
