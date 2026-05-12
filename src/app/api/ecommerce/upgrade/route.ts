import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/ecommerce/upgrade
 * Legacy endpoint. FlowShop no longer has Basic/Pro subscriptions.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "FLOWSHOP_PLANS_REMOVED",
        message: "FlowShop is included with your FlowSmartly account. Use credits to unlock more product listings.",
      },
    },
    { status: 410 }
  );
}
