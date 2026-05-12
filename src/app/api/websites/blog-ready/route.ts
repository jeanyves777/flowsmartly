import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getBlogReadinessForUser } from "@/lib/website/blog-posting";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const readiness = await getBlogReadinessForUser(session.userId);
    return NextResponse.json({
      success: true,
      data: {
        ready: readiness.ready,
        blockers: readiness.blockers,
        website: readiness.website
          ? {
              id: readiness.website.id,
              name: readiness.website.name,
              slug: readiness.website.slug,
              status: readiness.website.status,
              buildStatus: readiness.website.buildStatus,
              generatorVersion: readiness.website.generatorVersion,
              ssrStatus: readiness.website.ssrStatus,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("GET /api/websites/blog-ready error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
