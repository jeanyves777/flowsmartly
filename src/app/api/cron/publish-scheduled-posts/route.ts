import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { publishDueScheduledPosts } from "@/lib/content/scheduled-post-publisher";

async function run(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const result = await publishDueScheduledPosts();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Publish scheduled posts cron error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to publish scheduled posts" } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
