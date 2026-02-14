import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAllDynamicCreditCosts } from "@/lib/credits/costs";

// GET /api/credits/costs — Return current dynamic credit costs for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keysParam = searchParams.get("keys");

    const allCosts = await getAllDynamicCreditCosts();

    // If specific keys requested, filter
    if (keysParam) {
      const keys = keysParam.split(",");
      const filtered: Record<string, number> = {};
      for (const key of keys) {
        const k = key.trim();
        if (k in allCosts) {
          filtered[k] = allCosts[k as keyof typeof allCosts];
        }
      }
      return NextResponse.json({ success: true, data: { costs: filtered } });
    }

    return NextResponse.json({ success: true, data: { costs: allCosts } });
  } catch (error) {
    console.error("Error fetching credit costs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch credit costs" },
      { status: 500 }
    );
  }
}
