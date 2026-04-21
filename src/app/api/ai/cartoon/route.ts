import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCartoonVideos } from "@/lib/cartoon";
import { presignAllUrls } from "@/lib/utils/s3-client";

// POST /api/ai/cartoon - MAINTENANCE (Phase A cartoon recovery, 2026-04-20)
//
// New cartoon generations are blocked while we rebuild the animation
// pipeline (production server has no ffmpeg / SadTalker / TorchServe — see
// /api/ai/cartoon/health). The original handler is preserved in git
// history at commit 4f6c483 if you need to restore it.
//
// The GET handler below still works so existing cartoons remain viewable.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "FEATURE_UNDER_MAINTENANCE",
        message:
          "Cartoon Maker is being rebuilt and temporarily unavailable. Check back soon — your existing cartoons remain viewable in your history.",
      },
    },
    { status: 503 },
  );
}

// GET /api/ai/cartoon - List user's cartoon videos
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const videos = await listCartoonVideos(session.userId, Math.min(limit, 50));

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({ videos }),
    });
  } catch (error) {
    console.error("Cartoon list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch cartoon videos" } },
      { status: 500 }
    );
  }
}
