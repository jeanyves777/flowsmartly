import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserDelegations } from "@/lib/teams/delegation";

// GET /api/delegations — List all active delegations for the current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const delegations = await getUserDelegations(session.userId);

    return NextResponse.json({ success: true, data: delegations });
  } catch (error) {
    console.error("Get delegations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch delegations" } },
      { status: 500 }
    );
  }
}
