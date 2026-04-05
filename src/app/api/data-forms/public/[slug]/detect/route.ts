import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// POST /api/data-forms/public/[slug]/detect
// Check if a device fingerprint matches a known contact
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { fingerprint } = body as { fingerprint: string };

    if (!fingerprint || fingerprint.length < 16) {
      return NextResponse.json({ success: true, data: { detected: false } });
    }

    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: { id: true, type: true, status: true, userId: true },
    });

    if (!form || form.status !== "ACTIVE" || !['SMART_COLLECT','ATTENDANCE'].includes(form.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    // Look up fingerprint for this form owner's contacts
    const match = await prisma.deviceFingerprint.findUnique({
      where: {
        userId_fingerprint: {
          userId: form.userId,
          fingerprint,
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            status: true,
          },
        },
      },
    });

    if (!match || match.contact.status !== "ACTIVE") {
      return NextResponse.json({ success: true, data: { detected: false } });
    }

    // Update lastSeenAt
    await prisma.deviceFingerprint.update({
      where: { id: match.id },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        detected: true,
        contact: {
          id: match.contact.id,
          firstName: match.contact.firstName,
          lastName: match.contact.lastName,
          imageUrl: match.contact.imageUrl,
        },
        deviceLabel: match.deviceLabel,
      },
    });
  } catch (error) {
    console.error("Device detect error:", error);
    return NextResponse.json({ success: true, data: { detected: false } });
  }
}
