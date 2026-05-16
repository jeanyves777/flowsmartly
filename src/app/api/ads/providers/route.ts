import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPlacementChannels } from "@/lib/ads/placement-engine";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        providers: getPlacementChannels(),
      },
    });
  } catch (error) {
    console.error("Get ad providers error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load ad providers" } },
      { status: 500 }
    );
  }
}
