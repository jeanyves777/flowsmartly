/**
 * ROAS (Return on Ad Spend) attribution tracker.
 * Matches order UTM params to AdCampaigns and tracks revenue.
 */

import { prisma } from "@/lib/db/client";

/**
 * After an order is created, attempt to attribute it to an AdCampaign
 * via UTM parameters. If a match is found, increment campaign revenue.
 */
export async function attributeOrderToAd(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalCents: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        adCampaignId: true,
      },
    });

    if (!order) return;

    // If there's a direct campaign ID link, use that
    let campaignId = order.adCampaignId;

    // Otherwise, try to match via UTM campaign name
    if (!campaignId && order.utmCampaign) {
      const campaign = await prisma.adCampaign.findFirst({
        where: {
          OR: [
            { id: order.utmCampaign },
            { name: order.utmCampaign },
          ],
        },
        select: { id: true },
      });
      if (campaign) {
        campaignId = campaign.id;
      }
    }

    if (!campaignId) return;

    // Increment campaign revenue and order count
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        revenueTrackedCents: { increment: order.totalCents },
        adOrderCount: { increment: 1 },
      },
    });

    // Link the order to the campaign
    if (!order.adCampaignId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { adCampaignId: campaignId },
      });
    }
  } catch (error) {
    console.error("ROAS attribution error:", error);
  }
}

/**
 * Get ROAS metrics for a single campaign
 */
export async function getCampaignROAS(campaignId: string) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      budgetCents: true,
      spentCents: true,
      revenueTrackedCents: true,
      adOrderCount: true,
      impressions: true,
      clicks: true,
    },
  });

  if (!campaign) return null;

  const spent = campaign.spentCents;
  const revenue = campaign.revenueTrackedCents;
  const roas = spent > 0 ? revenue / spent : 0;

  return {
    campaignId: campaign.id,
    name: campaign.name,
    spentCents: spent,
    revenueCents: revenue,
    roas: Math.round(roas * 100) / 100,
    orderCount: campaign.adOrderCount,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
  };
}

/**
 * Get ROAS dashboard data for all campaigns linked to a store
 */
export async function getROASDashboardData(storeId: string) {
  const campaigns = await prisma.adCampaign.findMany({
    where: { sourceStoreId: storeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      adType: true,
      budgetCents: true,
      spentCents: true,
      revenueTrackedCents: true,
      adOrderCount: true,
      impressions: true,
      clicks: true,
      sourceProductId: true,
      createdAt: true,
    },
  });

  // Also fetch product names for campaigns with sourceProductId
  const productIds = campaigns
    .map((c) => c.sourceProductId)
    .filter((id): id is string => !!id);

  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, images: true },
      })
    : [];

  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalSpent = 0;
  let totalRevenue = 0;
  let totalOrders = 0;

  const campaignData = campaigns.map((c) => {
    totalSpent += c.spentCents;
    totalRevenue += c.revenueTrackedCents;
    totalOrders += c.adOrderCount;

    const product = c.sourceProductId ? productMap.get(c.sourceProductId) : null;
    let productImage: string | null = null;
    if (product?.images) {
      try {
        const imgs = JSON.parse(product.images as string || "[]");
        productImage = imgs[0]?.url || null;
      } catch {}
    }

    const roas = c.spentCents > 0 ? c.revenueTrackedCents / c.spentCents : 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      adType: c.adType,
      spentCents: c.spentCents,
      budgetCents: c.budgetCents,
      revenueCents: c.revenueTrackedCents,
      roas: Math.round(roas * 100) / 100,
      orderCount: c.adOrderCount,
      impressions: c.impressions,
      clicks: c.clicks,
      productName: product?.name || null,
      productImage,
      createdAt: c.createdAt.toISOString(),
    };
  });

  const overallRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  return {
    summary: {
      totalSpentCents: totalSpent,
      totalRevenueCents: totalRevenue,
      overallRoas: Math.round(overallRoas * 100) / 100,
      totalOrders,
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
    },
    campaigns: campaignData,
  };
}
