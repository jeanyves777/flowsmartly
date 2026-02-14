import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/sms/numbers - Get all users' SMS numbers with compliance/A2P status
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all, pending, approved, failed, no_number
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter logic
    switch (filter) {
      case "has_number":
        where.smsPhoneNumber = { not: null };
        break;
      case "no_registration":
        where.smsPhoneNumber = { not: null };
        where.smsA2pBrandSid = null;
        where.smsTollfreeVerifySid = null;
        break;
      case "a2p_pending":
        where.smsA2pCampaignSid = { not: null };
        where.NOT = {
          smsA2pCampaignStatus: { in: ["VERIFIED", "SUCCESSFUL"] },
        };
        break;
      case "a2p_approved":
        where.smsA2pCampaignStatus = { in: ["VERIFIED", "SUCCESSFUL"] };
        break;
      case "a2p_failed":
        where.OR = [
          { smsA2pBrandStatus: "FAILED" },
          { smsA2pCampaignStatus: "FAILED" },
        ];
        break;
      case "tollfree_pending":
        where.smsTollfreeVerifySid = { not: null };
        where.NOT = {
          smsTollfreeVerifyStatus: { in: ["TWILIO_APPROVED", "TWILIO_REJECTED"] },
        };
        break;
      case "tollfree_approved":
        where.smsTollfreeVerifyStatus = "TWILIO_APPROVED";
        break;
      // "all" = no extra filter
    }

    // Search by user name, email, business name, or phone number
    if (search) {
      const searchFilter = [
        { businessName: { contains: search } },
        { smsPhoneNumber: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
      if (where.OR) {
        // Wrap existing OR with AND
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    const [configs, total] = await Promise.all([
      prisma.marketingConfig.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          userId: true,
          smsEnabled: true,
          smsPhoneNumber: true,
          smsPhoneNumberSid: true,
          smsVerified: true,
          businessName: true,
          smsComplianceStatus: true,
          // A2P fields
          smsA2pBrandSid: true,
          smsA2pBrandStatus: true,
          smsA2pCampaignSid: true,
          smsA2pCampaignStatus: true,
          smsA2pMessagingServiceSid: true,
          smsA2pProfileSid: true,
          // Toll-free fields
          smsTollfreeVerifySid: true,
          smsTollfreeVerifyStatus: true,
          // Emergency address
          smsEmergencyAddressSid: true,
          // Metadata
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.marketingConfig.count({ where }),
    ]);

    // Compute summary stats
    const allConfigs = await prisma.marketingConfig.findMany({
      where: { smsPhoneNumber: { not: null } },
      select: {
        smsPhoneNumber: true,
        smsA2pBrandStatus: true,
        smsA2pCampaignStatus: true,
        smsTollfreeVerifyStatus: true,
        smsTollfreeVerifySid: true,
        smsA2pCampaignSid: true,
        smsA2pBrandSid: true,
      },
    });

    const isTollFree = (phone: string | null) =>
      phone ? /^\+1(800|833|844|855|866|877|888)/.test(phone) : false;

    const stats = {
      totalNumbers: allConfigs.length,
      localNumbers: allConfigs.filter((c) => !isTollFree(c.smsPhoneNumber)).length,
      tollFreeNumbers: allConfigs.filter((c) => isTollFree(c.smsPhoneNumber)).length,
      a2pApproved: allConfigs.filter(
        (c) =>
          c.smsA2pBrandStatus === "APPROVED" &&
          (c.smsA2pCampaignStatus === "VERIFIED" || c.smsA2pCampaignStatus === "SUCCESSFUL")
      ).length,
      a2pPending: allConfigs.filter(
        (c) =>
          c.smsA2pCampaignSid &&
          c.smsA2pCampaignStatus !== "VERIFIED" &&
          c.smsA2pCampaignStatus !== "SUCCESSFUL" &&
          c.smsA2pCampaignStatus !== "FAILED" &&
          c.smsA2pBrandStatus !== "FAILED"
      ).length,
      a2pFailed: allConfigs.filter(
        (c) => c.smsA2pBrandStatus === "FAILED" || c.smsA2pCampaignStatus === "FAILED"
      ).length,
      noRegistration: allConfigs.filter(
        (c) => !c.smsA2pBrandSid && !c.smsTollfreeVerifySid && !isTollFree(c.smsPhoneNumber)
      ).length,
      tollfreeApproved: allConfigs.filter(
        (c) => c.smsTollfreeVerifyStatus === "TWILIO_APPROVED"
      ).length,
      tollfreePending: allConfigs.filter(
        (c) =>
          c.smsTollfreeVerifySid &&
          c.smsTollfreeVerifyStatus !== "TWILIO_APPROVED" &&
          c.smsTollfreeVerifyStatus !== "TWILIO_REJECTED"
      ).length,
    };

    const formattedConfigs = configs.map((config) => {
      const tollFree = isTollFree(config.smsPhoneNumber);
      let overallStatus: string;

      if (!config.smsPhoneNumber) {
        overallStatus = "NO_NUMBER";
      } else if (tollFree) {
        if (config.smsTollfreeVerifyStatus === "TWILIO_APPROVED") {
          overallStatus = "APPROVED";
        } else if (config.smsTollfreeVerifyStatus === "TWILIO_REJECTED") {
          overallStatus = "FAILED";
        } else if (config.smsTollfreeVerifySid) {
          overallStatus = "PENDING";
        } else {
          overallStatus = "NOT_REGISTERED";
        }
      } else {
        // Local number — A2P status
        if (
          config.smsA2pBrandStatus === "APPROVED" &&
          (config.smsA2pCampaignStatus === "VERIFIED" ||
            config.smsA2pCampaignStatus === "SUCCESSFUL")
        ) {
          overallStatus = "APPROVED";
        } else if (
          config.smsA2pBrandStatus === "FAILED" ||
          config.smsA2pCampaignStatus === "FAILED"
        ) {
          overallStatus = "FAILED";
        } else if (config.smsA2pBrandSid) {
          overallStatus = "PENDING";
        } else {
          overallStatus = "NOT_REGISTERED";
        }
      }

      return {
        ...config,
        isTollFree: tollFree,
        overallStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        numbers: formattedConfigs,
        stats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get admin SMS numbers error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch SMS numbers" } },
      { status: 500 }
    );
  }
}
