import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { deleteClonedVoice } from "@/lib/voice/openai-voice-client";
import { deleteClonedVoice as deleteElevenLabsVoice } from "@/lib/voice/elevenlabs-client";

/**
 * DELETE /api/ai/voice-studio/profiles/[id] — Delete a voice profile
 *
 * Verifies ownership, cleans up any ElevenLabs cloned voice if applicable,
 * then deletes the profile from the database.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find profile and verify ownership
    const profile = await prisma.voiceProfile.findFirst({
      where: { id, userId: session.userId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Voice profile not found" },
        { status: 404 }
      );
    }

    // If it's a cloned voice, delete from the provider
    if (profile.type === "cloned") {
      // Delete from OpenAI if present
      if (profile.openaiVoiceId) {
        try {
          await deleteClonedVoice(profile.openaiVoiceId);
        } catch (err) {
          console.warn(
            "[VoiceStudio] Failed to delete OpenAI voice:",
            err instanceof Error ? err.message : err
          );
        }
      }
      // Delete from ElevenLabs if present (legacy profiles)
      if (profile.elevenLabsVoiceId) {
        try {
          await deleteElevenLabsVoice(profile.elevenLabsVoiceId);
        } catch (err) {
          console.warn(
            "[VoiceStudio] Failed to delete ElevenLabs voice:",
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    // Delete from database
    await prisma.voiceProfile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VoiceStudio] Delete profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete profile" },
      { status: 500 }
    );
  }
}
