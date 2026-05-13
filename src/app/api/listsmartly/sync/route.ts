import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/listsmartly/sync - Get latest sync job status
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const latestJob = await prisma.listingSyncJob.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    const syncJob = latestJob
      ? {
          ...latestJob,
          details: latestJob.details ? JSON.parse(latestJob.details) : {},
        }
      : null;

    return NextResponse.json({
      success: true,
      data: syncJob
        ? {
            ...syncJob,
            syncJob,
          }
        : { syncJob: null },
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch sync status" } },
      { status: 500 }
    );
  }
}
