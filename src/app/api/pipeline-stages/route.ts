import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ensureDefaultStages } from "@/lib/crm/pipeline";

// GET /api/pipeline-stages — the user's pipeline stages (seeds defaults on first use).
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const stages = await ensureDefaultStages(session.userId);
    return NextResponse.json({ success: true, data: { stages } });
  } catch (error) {
    console.error("List pipeline stages error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load pipeline stages" } }, { status: 500 });
  }
}
