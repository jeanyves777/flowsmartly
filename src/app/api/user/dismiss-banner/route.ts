import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/user/dismiss-banner - Persist banner dismissal
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { bannerId } = await request.json();
    if (!bannerId || typeof bannerId !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "Banner ID is required" } },
        { status: 400 }
      );
    }

    // Load current dismissed banners
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { dismissedBanners: true },
    });

    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(user?.dismissedBanners || "[]");
    } catch {
      dismissed = [];
    }

    // Add if not already dismissed
    if (!dismissed.includes(bannerId)) {
      dismissed.push(bannerId);
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { dismissedBanners: JSON.stringify(dismissed) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dismiss banner error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to dismiss banner" } },
      { status: 500 }
    );
  }
}
