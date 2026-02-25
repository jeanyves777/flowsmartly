import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/ai/voice-studio/profiles — List user's voice profiles
 *
 * Returns all voice profiles for the authenticated user, ordered by
 * default status, last used, then creation date.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profiles = await prisma.voiceProfile.findMany({
      where: { userId: session.userId },
      orderBy: [
        { isDefault: "desc" },
        { lastUsedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ success: true, data: { profiles } });
  } catch (error) {
    console.error("[VoiceStudio] List profiles error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load profiles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/voice-studio/profiles — Create a new voice profile
 *
 * Saves voice preferences as a reusable profile. No credits required.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, gender, accent, style, openaiVoice, isDefault = false } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json(
        { error: "Profile name is required" },
        { status: 400 }
      );
    }

    // If setting as default, unset all other defaults first
    if (isDefault) {
      await prisma.voiceProfile.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.voiceProfile.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        type: "preset",
        gender: gender || null,
        accent: accent || null,
        style: style || null,
        openaiVoice: openaiVoice || null,
        isDefault,
      },
    });

    return NextResponse.json({ success: true, data: { profile } });
  } catch (error) {
    console.error("[VoiceStudio] Create profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create profile" },
      { status: 500 }
    );
  }
}
