import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { issueRespondentToken } from "@/lib/data-forms/respondent-token";

// POST /api/data-forms/public/[slug]/detect
// Check if a device fingerprint matches a known contact.
//
// The gate here is the fingerprint itself: 16+ characters that must already
// exist against this form owner, which is not something a caller can guess. It
// still returns a token rather than a contact id, and it only greets people who
// are in the list this form is bound to — otherwise the greeting would lead
// straight into a lookup the completion endpoints will refuse.
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
      select: { id: true, type: true, status: true, userId: true, contactListId: true },
    });

    if (!form || form.status !== "ACTIVE" || !['SMART_COLLECT','ATTENDANCE'].includes(form.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    // Fail closed: no linked list means this form has no audience to recognise.
    if (!form.contactListId) {
      return NextResponse.json({ success: true, data: { detected: false } });
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
            lists: {
              where: { contactListId: form.contactListId },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!match || match.contact.status !== "ACTIVE") {
      return NextResponse.json({ success: true, data: { detected: false } });
    }

    // Only greet people this form can actually serve.
    if (match.contact.lists.length === 0) {
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
          token: issueRespondentToken(form.id, match.contact.id),
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
