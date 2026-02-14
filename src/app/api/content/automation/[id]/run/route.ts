import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { openaiClient } from "@/lib/ai/openai-client";
import { soraClient } from "@/lib/ai/sora-client";
import { uploadToS3 } from "@/lib/utils/s3-client";

// POST /api/content/automation/[id]/run - Manually trigger an automation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Automation ID is required" } },
        { status: 400 }
      );
    }

    // Load the automation
    const automation = await prisma.postAutomation.findUnique({
      where: { id },
    });

    if (!automation) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    if (automation.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to run this automation" } },
        { status: 403 }
      );
    }

    // Check if automation has ended
    if (automation.endDate && new Date() > automation.endDate) {
      return NextResponse.json(
        { success: false, error: { message: "This automation has ended. Update the end date to continue." } },
        { status: 400 }
      );
    }

    // Calculate total credit cost
    let creditCost = await getDynamicCreditCost("AI_POST"); // Base: 5 credits (text generation)

    if (automation.includeMedia) {
      if (automation.mediaType === "image") {
        creditCost += await getDynamicCreditCost("AI_VISUAL_DESIGN"); // +125 (gpt-image-1)
      } else if (automation.mediaType === "video") {
        creditCost += await getDynamicCreditCost("AI_VIDEO_STUDIO"); // +200 (Sora)
      }
    }

    // Check credits
    if (session.user.aiCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Not enough credits. Required: ${creditCost}, Available: ${session.user.aiCredits}`,
          },
        },
        { status: 402 }
      );
    }

    // Generate AI text content
    const topicContext = automation.topic ? `Topic: ${automation.topic}. ` : "";
    const prompt = automation.aiPrompt || "Write an engaging social media post";
    const toneInstruction = automation.aiTone
      ? `Use a ${automation.aiTone} tone.`
      : "Use a professional tone.";

    const generatedContent = await ai.generate(
      `${topicContext}${prompt}. ${toneInstruction} Include relevant hashtags. Keep it engaging and concise.`,
      {
        maxTokens: 512,
        systemPrompt:
          "You are an expert social media content creator. Write engaging, platform-ready posts.",
      }
    );

    if (!generatedContent?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "AI failed to generate content" } },
        { status: 500 }
      );
    }

    // Parse hashtags and mentions
    const hashtags = generatedContent.match(/#[\w]+/g) || [];
    const mentions = generatedContent.match(/@[\w]+/g) || [];

    // Generate media if enabled
    let mediaUrl: string | null = null;
    let mediaMeta: string | null = null;
    let postMediaType: string | null = null;

    if (automation.includeMedia && automation.mediaType) {
      try {
        const styleHint = automation.mediaStyle ? `. Style: ${automation.mediaStyle}` : "";
        // Use the generated caption as context for the media prompt
        const captionExcerpt = generatedContent.replace(/#[\w]+/g, "").trim().substring(0, 200);
        const mediaPrompt = `Create a social media visual for: ${captionExcerpt}${styleHint}`;

        if (automation.mediaType === "image") {
          // Use OpenAI gpt-image-1 for best quality
          console.log(`[AutomationRun] Generating image with gpt-image-1...`);
          const base64Image = await openaiClient.generateImage(mediaPrompt, {
            size: "1536x1024",
            quality: "medium",
          });

          if (base64Image) {
            const imageBuffer = Buffer.from(base64Image, "base64");
            const s3Key = `automation/${automation.id}/${Date.now()}.png`;
            mediaUrl = await uploadToS3(s3Key, imageBuffer, "image/png");
            mediaMeta = JSON.stringify([{ url: mediaUrl, type: "image" }]);
            postMediaType = "image";
            console.log(`[AutomationRun] Image uploaded: ${mediaUrl}`);
          }
        } else if (automation.mediaType === "video") {
          // Use OpenAI Sora for best quality video
          console.log(`[AutomationRun] Generating video with Sora...`);
          const result = await soraClient.generateVideoBuffer(mediaPrompt, {
            model: "sora-2",
            seconds: "8",
            size: "1280x720",
          });

          if (result?.videoBuffer) {
            const s3Key = `automation/${automation.id}/${Date.now()}.mp4`;
            mediaUrl = await uploadToS3(s3Key, result.videoBuffer, "video/mp4");
            mediaMeta = JSON.stringify([
              { url: mediaUrl, type: "video", duration: result.duration },
            ]);
            postMediaType = "video";
            console.log(`[AutomationRun] Video uploaded: ${mediaUrl}`);
          }
        }
      } catch (mediaError) {
        // Media generation failed — continue with text-only post
        console.warn("[AutomationRun] Media generation failed, continuing text-only:", mediaError);
      }
    }

    // Schedule for 1 hour from now
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

    // Parse platforms
    let platforms: string[] = [];
    try {
      platforms = JSON.parse(automation.platforms || "[]");
    } catch {
      platforms = ["feed"];
    }

    // Create the post, deduct credits, and update automation in a transaction
    const [post] = await prisma.$transaction([
      prisma.post.create({
        data: {
          userId: session.userId,
          caption: generatedContent,
          hashtags: JSON.stringify(hashtags),
          mentions: JSON.stringify(mentions),
          platforms: JSON.stringify(platforms),
          status: "SCHEDULED",
          scheduledAt,
          mediaUrl,
          mediaMeta,
          mediaType: postMediaType,
        },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          type: "USAGE",
          amount: -creditCost,
          balanceAfter: session.user.aiCredits - creditCost,
          referenceType: "ai_usage",
          description: `AI post automation${automation.includeMedia ? ` + ${automation.mediaType}` : ""}`,
        },
      }),
      prisma.postAutomation.update({
        where: { id },
        data: {
          lastTriggered: new Date(),
          totalGenerated: { increment: 1 },
          totalCreditsSpent: { increment: creditCost },
        },
      }),
    ]);

    // Fire-and-forget: sync strategy tasks after post automation run
    triggerActivitySyncForUser(session.userId).catch((err) =>
      console.error("Activity sync hook (post automation) failed:", err)
    );

    return NextResponse.json({
      success: true,
      data: {
        generatedContent,
        postId: post.id,
        scheduledAt: scheduledAt.toISOString(),
        creditsUsed: creditCost,
        mediaUrl,
        mediaType: postMediaType,
      },
    });
  } catch (error) {
    console.error("Run automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to run automation" } },
      { status: 500 }
    );
  }
}
