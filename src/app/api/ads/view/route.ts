import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { calculateAdRevenueSplit } from "@/lib/credits/costs";

const VIEW_DURATION_SECONDS = 35;
const MAX_VIEWS_PER_HOUR = 10; // Rate limit: max ad views per hour per user
const TIME_TOLERANCE_SECONDS = 3; // Allow small timing tolerance

// POST /api/ads/view - Start or complete an ad view session
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, postId, campaignId, viewId } = body;

    if (action === "start") {
      if (campaignId && !postId) {
        return handleStartCampaignView(session.userId, campaignId);
      }
      return handleStartView(session.userId, postId);
    } else if (action === "complete") {
      return handleCompleteView(session.userId, viewId);
    }

    return NextResponse.json(
      { success: false, error: { message: "Invalid action. Use 'start' or 'complete'." } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Ad view error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process ad view" } },
      { status: 500 }
    );
  }
}

async function handleStartView(viewerUserId: string, postId: string) {
  if (!postId) {
    return NextResponse.json(
      { success: false, error: { message: "Post ID is required" } },
      { status: 400 }
    );
  }

  // 1. Get the promoted post and its campaign
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      isPromoted: true,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      userId: true,
      campaignId: true,
      adCampaign: {
        select: {
          id: true,
          status: true,
          budgetCents: true,
          spentCents: true,
          cpvCents: true,
        },
      },
    },
  });

  if (!post || !post.adCampaign) {
    return NextResponse.json(
      { success: false, error: { message: "Promoted post not found or campaign inactive" } },
      { status: 404 }
    );
  }

  // 2. Viewer cannot earn from their own post
  if (post.userId === viewerUserId) {
    return NextResponse.json(
      { success: false, error: { message: "You cannot earn from your own promoted post" } },
      { status: 400 }
    );
  }

  // 3. Campaign must be ACTIVE
  if (post.adCampaign.status !== "ACTIVE") {
    return NextResponse.json(
      { success: false, error: { message: "Campaign is not active" } },
      { status: 400 }
    );
  }

  // 4. Campaign must have remaining budget
  const remainingBudget = post.adCampaign.budgetCents - post.adCampaign.spentCents;
  if (remainingBudget < post.adCampaign.cpvCents) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign budget exhausted" } },
      { status: 400 }
    );
  }

  // 5. Check if user already earned from this post
  const existingView = await prisma.postView.findUnique({
    where: {
      postId_viewerUserId: {
        postId,
        viewerUserId,
      },
    },
  });

  if (existingView && existingView.earnedCents > 0) {
    return NextResponse.json(
      { success: false, error: { message: "You have already earned from this ad" } },
      { status: 400 }
    );
  }

  // 6. Rate limiting: max views per hour
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentViews = await prisma.postView.count({
    where: {
      viewerUserId,
      createdAt: { gte: oneHourAgo },
      earnedCents: { gt: 0 },
    },
  });

  if (recentViews >= MAX_VIEWS_PER_HOUR) {
    return NextResponse.json(
      { success: false, error: { message: "Rate limit reached. Try again later." } },
      { status: 429 }
    );
  }

  // 7. Create or update the view record (pending state: earnedCents=0)
  const view = existingView
    ? await prisma.postView.update({
        where: { id: existingView.id },
        data: {
          viewDuration: 0,
          earnedCents: 0,
          createdAt: new Date(), // Reset start time
        },
      })
    : await prisma.postView.create({
        data: {
          postId,
          viewerUserId,
          campaignId: post.adCampaign.id,
          viewDuration: 0,
          earnedCents: 0,
        },
      });

  const { viewerCents } = calculateAdRevenueSplit(post.adCampaign.cpvCents);

  return NextResponse.json({
    success: true,
    data: {
      viewId: view.id,
      startedAt: view.createdAt.toISOString(),
      durationRequired: VIEW_DURATION_SECONDS,
      earnAmount: viewerCents / 100, // Viewer's share in dollars for display
    },
  });
}

// Handle view start for non-post ad campaigns (PRODUCT_LINK, LANDING_PAGE, EXTERNAL_URL)
async function handleStartCampaignView(viewerUserId: string, campaignId: string) {
  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign ID is required" } },
      { status: 400 }
    );
  }

  // 1. Get the campaign
  const campaign = await prisma.adCampaign.findFirst({
    where: {
      id: campaignId,
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      adType: { not: "POST" },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      budgetCents: true,
      spentCents: true,
      cpvCents: true,
    },
  });

  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found or inactive" } },
      { status: 404 }
    );
  }

  // 2. Viewer cannot earn from their own campaign
  if (campaign.userId === viewerUserId) {
    return NextResponse.json(
      { success: false, error: { message: "You cannot earn from your own ad" } },
      { status: 400 }
    );
  }

  // 3. Campaign must have remaining budget
  const remainingBudget = campaign.budgetCents - campaign.spentCents;
  if (remainingBudget < campaign.cpvCents) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign budget exhausted" } },
      { status: 400 }
    );
  }

  // 4. Rate limiting: max views per hour
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentViews = await prisma.postView.count({
    where: {
      viewerUserId,
      createdAt: { gte: oneHourAgo },
      earnedCents: { gt: 0 },
    },
  });

  if (recentViews >= MAX_VIEWS_PER_HOUR) {
    return NextResponse.json(
      { success: false, error: { message: "Rate limit reached. Try again later." } },
      { status: 429 }
    );
  }

  // 5. Check if user already viewed this campaign
  // Use a pseudo-postId based on campaignId so the unique constraint works
  const pseudoPostId = `campaign_${campaignId}`;
  const existingView = await prisma.postView.findFirst({
    where: {
      viewerUserId,
      campaignId,
      earnedCents: { gt: 0 },
    },
  });

  if (existingView) {
    return NextResponse.json(
      { success: false, error: { message: "You have already earned from this ad" } },
      { status: 400 }
    );
  }

  // 6. Find any post to link to (campaigns need a postId due to schema constraint)
  // For non-post campaigns, we'll find the first post in the system as a placeholder
  const anyPost = await prisma.post.findFirst({
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (!anyPost) {
    return NextResponse.json(
      { success: false, error: { message: "System error: no posts available" } },
      { status: 500 }
    );
  }

  // 7. Create view record
  const view = await prisma.postView.create({
    data: {
      postId: anyPost.id,
      viewerUserId,
      campaignId: campaign.id,
      viewDuration: 0,
      earnedCents: 0,
    },
  });

  const { viewerCents } = calculateAdRevenueSplit(campaign.cpvCents);

  return NextResponse.json({
    success: true,
    data: {
      viewId: view.id,
      startedAt: view.createdAt.toISOString(),
      durationRequired: VIEW_DURATION_SECONDS,
      earnAmount: viewerCents / 100,
    },
  });
}

async function handleCompleteView(viewerUserId: string, viewId: string) {
  if (!viewId) {
    return NextResponse.json(
      { success: false, error: { message: "View ID is required" } },
      { status: 400 }
    );
  }

  // 1. Find the pending view
  const view = await prisma.postView.findFirst({
    where: {
      id: viewId,
      viewerUserId,
      earnedCents: 0, // Must be pending (not yet earned)
    },
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          budgetCents: true,
          spentCents: true,
          cpvCents: true,
          userId: true,
          adType: true,
        },
      },
      post: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!view) {
    return NextResponse.json(
      { success: false, error: { message: "View session not found or already completed" } },
      { status: 404 }
    );
  }

  // 2. Validate timing (must be at least 35 seconds since start)
  const elapsedSeconds = (Date.now() - view.createdAt.getTime()) / 1000;
  if (elapsedSeconds < VIEW_DURATION_SECONDS - TIME_TOLERANCE_SECONDS) {
    return NextResponse.json(
      { success: false, error: { message: `View not long enough. ${Math.ceil(VIEW_DURATION_SECONDS - elapsedSeconds)}s remaining.` } },
      { status: 400 }
    );
  }

  // 3. Campaign must still be active with budget
  if (!view.campaign || view.campaign.status !== "ACTIVE") {
    return NextResponse.json(
      { success: false, error: { message: "Campaign is no longer active" } },
      { status: 400 }
    );
  }

  const remainingBudget = view.campaign.budgetCents - view.campaign.spentCents;
  if (remainingBudget < view.campaign.cpvCents) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign budget exhausted" } },
      { status: 400 }
    );
  }

  // 4. Viewer cannot be the post/campaign owner (double check)
  const isOwnContent = view.campaign?.userId === viewerUserId || view.post.userId === viewerUserId;
  if (isOwnContent) {
    return NextResponse.json(
      { success: false, error: { message: "Cannot earn from own content" } },
      { status: 400 }
    );
  }

  // Split the CPV: viewer gets 70%, platform keeps 30%
  const totalCpvCents = view.campaign.cpvCents;
  const { viewerCents, platformCents } = calculateAdRevenueSplit(totalCpvCents);

  // 5. Execute the payment in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Update PostView with viewer's earned amount and actual duration
      await tx.postView.update({
        where: { id: view.id },
        data: {
          earnedCents: viewerCents,
          viewDuration: Math.round(elapsedSeconds),
        },
      });

      // Deduct the full CPV from campaign budget (advertiser pays the full amount)
      await tx.adCampaign.update({
        where: { id: view.campaign!.id },
        data: {
          spentCents: { increment: totalCpvCents },
          impressions: { increment: 1 },
        },
      });

      // Add viewer's share to their balance
      await tx.user.update({
        where: { id: viewerUserId },
        data: {
          balanceCents: { increment: viewerCents },
        },
      });

      // Create earning record (viewer's share only)
      await tx.earning.create({
        data: {
          userId: viewerUserId,
          amountCents: viewerCents,
          source: "AD_VIEW",
          sourceId: view.id,
        },
      });

      // Track platform revenue
      if (platformCents > 0) {
        await tx.earning.create({
          data: {
            userId: view.campaign!.userId, // Campaign owner as reference
            amountCents: platformCents,
            source: "PLATFORM_FEE",
            sourceId: view.id,
          },
        });
      }

      // Check if campaign budget is now exhausted → pause it
      const updatedCampaign = await tx.adCampaign.findUnique({
        where: { id: view.campaign!.id },
        select: { budgetCents: true, spentCents: true, cpvCents: true },
      });

      if (updatedCampaign) {
        const newRemaining = updatedCampaign.budgetCents - updatedCampaign.spentCents;
        if (newRemaining < updatedCampaign.cpvCents) {
          await tx.adCampaign.update({
            where: { id: view.campaign!.id },
            data: { status: "PAUSED" },
          });

          // Un-promote posts when budget runs out
          await tx.post.updateMany({
            where: { campaignId: view.campaign!.id },
            data: { isPromoted: false },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        earned: viewerCents / 100, // Viewer sees only their share
        earnedCents: viewerCents,
        viewDuration: Math.round(elapsedSeconds),
        message: `You earned $${(viewerCents / 100).toFixed(2)} for viewing this ad!`,
      },
    });
  } catch (error) {
    console.error("Complete ad view payment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process earning" } },
      { status: 500 }
    );
  }
}
