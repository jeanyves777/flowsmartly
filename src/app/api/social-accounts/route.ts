import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// Supported platforms with display metadata
const SUPPORTED_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "from-purple-500 to-pink-500" },
  { id: "twitter", name: "X (Twitter)", color: "from-gray-700 to-gray-900" },
  { id: "linkedin", name: "LinkedIn", color: "from-blue-500 to-blue-700" },
  { id: "facebook", name: "Facebook", color: "from-blue-400 to-blue-600" },
  { id: "tiktok", name: "TikTok", color: "from-gray-900 to-pink-500" },
  { id: "youtube", name: "YouTube", color: "from-red-500 to-red-700" },
  { id: "pinterest", name: "Pinterest", color: "from-red-400 to-red-600" },
  { id: "threads", name: "Threads", color: "from-gray-800 to-gray-950" },
];

// GET /api/social-accounts - Get user's social connections
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const connectedAccounts = await prisma.socialAccount.findMany({
      where: { userId: session.userId, isActive: true },
      select: {
        id: true,
        platform: true,
        platformUsername: true,
        platformDisplayName: true,
        platformAvatarUrl: true,
        connectedAt: true,
      },
    });

    // Build a map of connected accounts by platform
    const connectedMap = new Map(
      connectedAccounts.map((a) => [a.platform, a])
    );

    // Merge with supported platforms list
    const platforms = SUPPORTED_PLATFORMS.map((p) => {
      const account = connectedMap.get(p.id);
      return {
        platform: p.id,
        name: p.name,
        color: p.color,
        connected: !!account,
        username: account?.platformUsername || null,
        displayName: account?.platformDisplayName || null,
        avatarUrl: account?.platformAvatarUrl || null,
        connectedAt: account?.connectedAt || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: { platforms },
    });
  } catch (error) {
    console.error("Social accounts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch social accounts" } },
      { status: 500 }
    );
  }
}
