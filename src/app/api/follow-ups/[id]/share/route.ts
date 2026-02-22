import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

function generateShareSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

async function generateUniqueSlug(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const slug = generateShareSlug();
    const existing = await prisma.followUp.findFirst({
      where: { shareSlug: slug },
    });
    if (!existing) {
      return slug;
    }
    attempts++;
  }
  throw new Error("Failed to generate unique slug");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify FollowUp ownership
    const followUp = await prisma.followUp.findUnique({
      where: { id },
    });

    if (!followUp) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 }
      );
    }

    if (followUp.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate unique share slug
    const shareSlug = await generateUniqueSlug();

    // Update follow-up with sharing enabled
    await prisma.followUp.update({
      where: { id },
      data: {
        shareSlug,
        shareEnabled: true,
      },
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/follow-ups/shared/${shareSlug}`;

    return NextResponse.json({
      shareSlug,
      shareUrl,
    });
  } catch (error) {
    console.error("Error enabling sharing:", error);
    return NextResponse.json(
      { error: "Failed to enable sharing" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify FollowUp ownership
    const followUp = await prisma.followUp.findUnique({
      where: { id },
    });

    if (!followUp) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 }
      );
    }

    if (followUp.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Disable sharing
    await prisma.followUp.update({
      where: { id },
      data: {
        shareSlug: null,
        shareEnabled: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling sharing:", error);
    return NextResponse.json(
      { error: "Failed to disable sharing" },
      { status: 500 }
    );
  }
}
