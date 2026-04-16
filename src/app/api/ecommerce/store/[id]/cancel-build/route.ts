import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { cancelBuild } from "@/lib/store-builder/store-site-builder";

/**
 * POST /api/ecommerce/store/[id]/cancel-build
 * Cancel an in-progress store build/generation.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, buildStatus: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (store.buildStatus !== "building") {
      return NextResponse.json({ error: "No build in progress" }, { status: 400 });
    }

    // Try to cancel the active build process
    const cancelled = cancelBuild(id);

    // Force-release the build lock
    await prisma.store.update({
      where: { id },
      data: {
        buildStatus: "error",
        lastBuildError: "Build cancelled by user",
        buildStartedAt: null,
        pendingRebuild: false,
      },
    });

    console.log(`[StoreBuild] Build cancelled for store ${id} (process killed: ${cancelled})`);

    return NextResponse.json({ success: true, processKilled: cancelled });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/cancel-build error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
