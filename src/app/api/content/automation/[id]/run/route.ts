import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { generateAutomationAsset } from "@/lib/strategy/automation-execution";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { soraClient } from "@/lib/ai/sora-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
import {
  isBlogAutomationPlatform,
  runBlogAutomationPublication,
  shouldPublishAsBlogAutomation,
} from "@/lib/content/blog-automation-runner";

function parsePlatforms(raw: string | null) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : ["feed"];
  } catch {
    return ["feed"];
  }
}

async function calculateRunCreditCost(automation: {
  includeMedia: boolean;
  mediaType: string | null;
}) {
  let creditCost = await getDynamicCreditCost("AI_POST");
  if (automation.includeMedia) {
    if (automation.mediaType === "image") {
      creditCost += await getDynamicCreditCost("AI_VISUAL_DESIGN");
    } else if (automation.mediaType === "video") {
      creditCost += await getDynamicCreditCost("AI_VIDEO_STUDIO");
    }
  }
  return creditCost;
}

// GET /api/content/automation/[id]/run - Preview a manual automation run before spending credits
export async function GET(
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

    const automation = await prisma.postAutomation.findUnique({ where: { id } });

    if (!automation) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    if (automation.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to preview this automation" } },
        { status: 403 }
      );
    }

    const creditCost = await calculateRunCreditCost(automation);
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
    const platforms = parsePlatforms(automation.platforms);
    const isBlogRun = isBlogAutomationPlatform(platforms);
    const linkedTask = automation.strategyTaskId
      ? await prisma.strategyTask.findFirst({
          where: {
            id: automation.strategyTaskId,
            strategy: { userId: session.userId },
          },
          select: { id: true, title: true, category: true },
        })
      : null;

    return NextResponse.json({
      success: true,
      data: {
        automation: {
          id: automation.id,
          name: automation.name,
          topic: automation.topic,
          aiPrompt: automation.aiPrompt,
          aiTone: automation.aiTone,
          includeMedia: automation.includeMedia,
          mediaType: automation.mediaType,
          mediaStyle: automation.mediaStyle,
          platforms,
          linkedTask,
        },
        creditCost,
        userCredits: session.user.aiCredits,
        hasEnoughCredits: session.user.aiCredits >= creditCost,
        scheduledAt: scheduledAt.toISOString(),
        result: isBlogRun
          ? automation.includeMedia
            ? "Generate a full website blog article, create a branded hero image, then publish it to the website blog."
            : "Generate a full website blog article, then publish it to the website blog."
          : automation.includeMedia
          ? `Generate one AI caption, create ${automation.mediaType || "media"}, then schedule a post.`
          : "Generate one AI caption, then schedule a text post.",
      },
    });
  } catch (error) {
    console.error("Preview automation run error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to preview automation run" } },
      { status: 500 }
    );
  }
}

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
    const creditCost = await calculateRunCreditCost(automation);

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

    const platforms = parsePlatforms(automation.platforms);
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({ where: { userId: session.userId } });
    }
    const linkedTask = automation.strategyTaskId
      ? await prisma.strategyTask.findFirst({
          where: {
            id: automation.strategyTaskId,
            strategy: { userId: session.userId },
          },
          select: {
            title: true,
            description: true,
            category: true,
            startDate: true,
            dueDate: true,
          },
        })
      : null;

    if (shouldPublishAsBlogAutomation(platforms, linkedTask)) {
      const blogResult = await runBlogAutomationPublication({
        automation,
        brandKit,
        linkedTask,
      });

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
            balanceAfter: session.user.aiCredits - creditCost,
            referenceType: "ai_usage",
            referenceId: blogResult.blogPostId,
            description: `Published website blog automation: ${automation.name}`,
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

      triggerActivitySyncForUser(session.userId).catch((err) =>
        console.error("Activity sync hook (blog automation) failed:", err)
      );

      return NextResponse.json({
        success: true,
        data: {
          generatedContent: blogResult.title,
          blogPostId: blogResult.blogPostId,
          websiteId: blogResult.websiteId,
          websiteName: blogResult.websiteName,
          creditsUsed: creditCost,
          mediaUrl: blogResult.imageUrl,
          mediaType: blogResult.imageUrl ? "image" : null,
          qualityNotes: blogResult.qualityNotes,
        },
      });
    }

    const generatedAsset = await generateAutomationAsset({
      topic: automation.topic,
      aiPrompt: automation.aiPrompt,
      aiTone: automation.aiTone,
      platforms,
      includeMedia: automation.includeMedia,
      mediaType: automation.mediaType,
      mediaStyle: automation.mediaStyle,
      brand: brandKit,
      task: linkedTask,
    });
    const generatedContent = generatedAsset.caption;

    if (!generatedContent?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "AI failed to generate content" } },
        { status: 500 }
      );
    }

    // Parse hashtags and mentions
    const hashtags = generatedAsset.hashtags.length ? generatedAsset.hashtags : generatedContent.match(/#[\w]+/g) || [];
    const mentions = generatedAsset.mentions.length ? generatedAsset.mentions : generatedContent.match(/@[\w]+/g) || [];

    // Generate media if enabled
    let mediaUrl: string | null = null;
    let mediaMeta: string | null = null;
    let postMediaType: string | null = null;

    if (automation.includeMedia && automation.mediaType) {
      try {
        const captionExcerpt = generatedContent.replace(/#[\w]+/g, "").trim().substring(0, 200);
        const mediaPrompt =
          generatedAsset.mediaPrompt ||
          `Create a social media visual for: ${captionExcerpt}${automation.mediaStyle ? `. Style: ${automation.mediaStyle}` : ""}. Do not fabricate logos or real-person faces. Leave logo space blank for compositing.`;

        if (automation.mediaType === "image") {
          console.log("[AutomationRun] Generating image with shared image router...");
          const generatedImage = await generateImageXaiFirst(mediaPrompt, 1536, 1024, { quality: "medium" });
          const base64Image = generatedImage.base64;

          if (base64Image) {
            let imageBuffer: Buffer = Buffer.from(base64Image, "base64");
            const brandLogo = brandKit?.logo || brandKit?.iconLogo || null;
            if (brandLogo) {
              try {
                imageBuffer = await compositeBrandLogoOnImageBuffer({
                  imageBuffer,
                  logoSource: brandLogo,
                  placement: { x: 0.03, y: 0.03, sizePercent: 14 },
                });
              } catch (logoError) {
                console.warn(`[AutomationRun] Logo compositing failed for ${automation.id}:`, logoError);
              }
            }
            const s3Key = `automation/${automation.id}/${Date.now()}.png`;
            await uploadToS3(s3Key, imageBuffer, "image/png");
            mediaUrl = s3Key;
            mediaMeta = JSON.stringify([s3Key]);
            postMediaType = "image";
            console.log(`[AutomationRun] Image uploaded: ${s3Key}`);
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
            await uploadToS3(s3Key, result.videoBuffer, "video/mp4");
            mediaUrl = s3Key;
            mediaMeta = JSON.stringify([s3Key]);
            postMediaType = "video";
            console.log(`[AutomationRun] Video uploaded: ${s3Key}`);
          }
        }
      } catch (mediaError) {
        // Media generation failed — continue with text-only post
        console.warn("[AutomationRun] Media generation failed, continuing text-only:", mediaError);
      }
    }

    // Schedule for 1 hour from now
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

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
        qualityNotes: generatedAsset.qualityNotes,
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
