import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { completeTask } from "@/lib/crm/sequence";

// POST /api/sequences/tasks — mark a lead's manual-task step done { enrollmentId }.
// The sequence resumes at the next step (its scheduler fires it next run).
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const enrollmentId = typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
    if (!enrollmentId) return NextResponse.json({ success: false, error: { message: "enrollmentId is required" } }, { status: 400 });
    const ok = await completeTask(enrollmentId, session.userId);
    if (!ok) return NextResponse.json({ success: false, error: { message: "No waiting task for that enrollment" } }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Complete task error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to complete task" } }, { status: 500 });
  }
}
