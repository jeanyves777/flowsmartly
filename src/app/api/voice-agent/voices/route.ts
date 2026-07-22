/**
 * Voice Agent — the voices a business can pick from.
 *
 * Now that the agent runs on ElevenLabs, the picker offers ElevenLabs' curated
 * premade voices (the same set the Training studio uses), so each business gets a
 * distinct, professional voice — not one shared fallback. Picking one stores its
 * 20-char ElevenLabs id, which the EL agent mapper uses directly.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { STUDIO_VOICES } from "@/lib/training/studio-voices";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const voices = STUDIO_VOICES.map((v) => ({
    voiceId: v.id,
    name: v.name,
    gender: v.gender,
    tag: v.tag,
    kind: "builtin" as const,
  }));

  return NextResponse.json({ success: true, voices });
}
