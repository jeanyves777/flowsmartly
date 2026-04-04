import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// POST /sites/[slug]/api/submit — Contact form submission
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const website = await prisma.website.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { blockId, data } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    await prisma.websiteFormSubmission.create({
      data: {
        websiteId: website.id,
        blockId: blockId || null,
        data: JSON.stringify(data),
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Form submission error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
