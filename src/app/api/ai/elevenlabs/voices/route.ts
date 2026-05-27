import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isElevenLabsEnabled, listVoices } from "@/lib/voice/elevenlabs-client";

/**
 * Returns the voices on the connected ElevenLabs account — premade + cloned.
 * Used by the narrator picker on the Story Ad Campaign Scenes step (and anywhere
 * else a user picks an ElevenLabs voice).
 *
 * Auth: requires a logged-in user but no admin. The voice catalog is the same for
 * every user since it lives on the platform's ElevenLabs account, not per-user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  if (!isElevenLabsEnabled()) {
    return NextResponse.json({
      success: true,
      data: { enabled: false, voices: [] },
    });
  }
  try {
    const voices = await listVoices();
    return NextResponse.json({
      success: true,
      data: { enabled: true, voices },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch voices";
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 },
    );
  }
}
