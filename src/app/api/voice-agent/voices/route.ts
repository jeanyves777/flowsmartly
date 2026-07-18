/**
 * Voice Agent — the voices a business can pick from.
 *
 * Built-in voices plus any the team has cloned, read live from the provider so
 * the list never drifts from what actually works on a call. Cached briefly
 * because it changes rarely and every brief open would otherwise hit xAI.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { listVoices } from "@/lib/voice-agent/xai-phone";

let cache: { at: number; voices: unknown[] } | null = null;
const TTL = 5 * 60_000;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ success: true, voices: cache.voices });
  }

  const r = await listVoices();
  if (!r.ok) {
    // Don't fail the brief over a voice-list hiccup — fall back to a couple of
    // safe defaults so the picker still works and the agent can still be built.
    return NextResponse.json({
      success: true,
      voices: [
        { voiceId: "eve", name: "Eve", gender: "female", kind: "builtin" },
        { voiceId: "leo", name: "Leo", gender: "male", kind: "builtin" },
      ],
      degraded: true,
    });
  }

  cache = { at: Date.now(), voices: r.voices };
  return NextResponse.json({ success: true, voices: r.voices });
}
