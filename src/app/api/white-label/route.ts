import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// Default white-label configuration (returned when user has no config)
const DEFAULT_CONFIG = {
  id: null,
  domain: null,
  appName: "FlowSmartly",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#f97316",
  secondaryColor: "#0ea5e9",
  accentColor: "#8b5cf6",
  customCss: null,
  footerText: null,
  supportEmail: null,
  isActive: false,
};

const ALLOWED_PLANS = ["ENTERPRISE", "BUSINESS"];

// GET /api/white-label - Get user's white-label configuration
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const config = await prisma.whiteLabelConfig.findFirst({
      where: { userId: session.userId },
    });

    if (!config) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_CONFIG,
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Get white-label config error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch white-label configuration" } },
      { status: 500 }
    );
  }
}

// POST /api/white-label - Create or update white-label configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    // Validate that user has a premium plan
    if (!ALLOWED_PLANS.includes(session.user.plan)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PLAN_REQUIRED",
            message: "White-label customization requires a Business or Enterprise plan",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      appName,
      domain,
      logoUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      customCss,
      footerText,
      supportEmail,
      isActive,
    } = body;

    // If a domain is provided, check it is not already taken by another user
    if (domain) {
      const existingDomain = await prisma.whiteLabelConfig.findUnique({
        where: { domain },
      });

      if (existingDomain && existingDomain.userId !== session.userId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DOMAIN_TAKEN",
              message: "This domain is already associated with another account",
            },
          },
          { status: 409 }
        );
      }
    }

    // Find existing config for this user
    const existingConfig = await prisma.whiteLabelConfig.findFirst({
      where: { userId: session.userId },
    });

    const configData = {
      appName: appName ?? "FlowSmartly",
      domain: domain ?? null,
      logoUrl: logoUrl ?? null,
      faviconUrl: faviconUrl ?? null,
      primaryColor: primaryColor ?? "#f97316",
      secondaryColor: secondaryColor ?? "#0ea5e9",
      accentColor: accentColor ?? "#8b5cf6",
      customCss: customCss ?? null,
      footerText: footerText ?? null,
      supportEmail: supportEmail ?? null,
      isActive: isActive ?? false,
    };

    let config;

    if (existingConfig) {
      config = await prisma.whiteLabelConfig.update({
        where: { id: existingConfig.id },
        data: configData,
      });
    } else {
      config = await prisma.whiteLabelConfig.create({
        data: {
          ...configData,
          userId: session.userId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Save white-label config error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SAVE_FAILED", message: "Failed to save white-label configuration" } },
      { status: 500 }
    );
  }
}

// DELETE /api/white-label - Delete white-label configuration
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const existingConfig = await prisma.whiteLabelConfig.findFirst({
      where: { userId: session.userId },
    });

    if (existingConfig) {
      await prisma.whiteLabelConfig.delete({
        where: { id: existingConfig.id },
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete white-label config error:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message: "Failed to delete white-label configuration" } },
      { status: 500 }
    );
  }
}
