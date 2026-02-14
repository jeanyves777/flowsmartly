import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import type { Prisma } from "@prisma/client";

// GET /api/admin/sms/compliance - List compliance submissions for admin review
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
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause: fetch records that have been submitted or have a non-default status
    let where: Prisma.MarketingConfigWhereInput = {
      OR: [
        { complianceSubmittedAt: { not: null } },
        { smsComplianceStatus: { not: "NOT_STARTED" } },
      ],
    };

    // Filter by status if provided
    if (status && status !== "all") {
      where = { smsComplianceStatus: status.toUpperCase() };
    }

    const [submissions, total] = await Promise.all([
      prisma.marketingConfig.findMany({
        where,
        orderBy: { complianceSubmittedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
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

    // Get stats by status
    const [pendingCount, approvedCount, rejectedCount, suspendedCount] =
      await Promise.all([
        prisma.marketingConfig.count({
          where: { smsComplianceStatus: "PENDING_REVIEW" },
        }),
        prisma.marketingConfig.count({
          where: { smsComplianceStatus: "APPROVED" },
        }),
        prisma.marketingConfig.count({
          where: { smsComplianceStatus: "REJECTED" },
        }),
        prisma.marketingConfig.count({
          where: { smsComplianceStatus: "SUSPENDED" },
        }),
      ]);

    const formattedSubmissions = submissions.map((config) => {
      let messageSamples: string[] = [];
      try {
        messageSamples = JSON.parse(config.smsMessageSamples || "[]");
      } catch {
        messageSamples = [];
      }

      return {
        id: config.id,
        userId: config.userId,
        user: config.user,
        businessName: config.businessName,
        businessWebsite: config.businessWebsite,
        privacyPolicyUrl: config.privacyPolicyUrl,
        termsOfServiceUrl: config.termsOfServiceUrl,
        smsUseCase: config.smsUseCase,
        smsUseCaseDescription: config.smsUseCaseDescription,
        smsMessageSamples: messageSamples,
        smsComplianceStatus: config.smsComplianceStatus,
        optOutMessage: config.optOutMessage,
        complianceSubmittedAt: config.complianceSubmittedAt?.toISOString() || null,
        complianceReviewedAt: config.complianceReviewedAt?.toISOString() || null,
        complianceReviewedBy: config.complianceReviewedBy,
        complianceNotes: config.complianceNotes,
        smsEnabled: config.smsEnabled,
        smsPhoneNumber: config.smsPhoneNumber,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        submissions: formattedSubmissions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          suspended: suspendedCount,
          total: pendingCount + approvedCount + rejectedCount + suspendedCount,
        },
      },
    });
  } catch (error) {
    console.error("Get admin compliance submissions error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to fetch compliance submissions" },
      },
      { status: 500 }
    );
  }
}
