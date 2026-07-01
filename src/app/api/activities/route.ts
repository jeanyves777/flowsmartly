import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/activities?opportunityId=&leadId= — timeline for a deal or lead.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const sp = request.nextUrl.searchParams;
    const opportunityId = sp.get("opportunityId") || undefined;
    const savedLeadId = sp.get("leadId") || undefined;

    const activities = await prisma.activity.findMany({
      where: { userId: session.userId, ...(opportunityId ? { opportunityId } : {}), ...(savedLeadId ? { savedLeadId } : {}) },
      orderBy: { at: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, data: { activities } });
  } catch (error) {
    console.error("List activities error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load activities" } }, { status: 500 });
  }
}

// POST /api/activities — log a touch { type, subject?, body?, opportunityId?, leadId? }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const body = await request.json();
    const type = String(body.type || "note").trim().slice(0, 24);

    const activity = await prisma.activity.create({
      data: {
        userId: session.userId,
        type,
        subject: typeof body.subject === "string" ? body.subject.slice(0, 200) : null,
        body: typeof body.body === "string" ? body.body.slice(0, 4000) : null,
        opportunityId: typeof body.opportunityId === "string" ? body.opportunityId : null,
        savedLeadId: typeof body.leadId === "string" ? body.leadId : null,
      },
    });
    return NextResponse.json({ success: true, data: { activity } }, { status: 201 });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to log activity" } }, { status: 500 });
  }
}
