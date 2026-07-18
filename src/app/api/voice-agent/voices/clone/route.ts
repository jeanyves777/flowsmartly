/**
 * Voice Agent — clone a voice, or import one the user already has.
 *
 * GET  → the user's cloned voices, so they can reuse one instead of re-cloning.
 * POST → clone a new voice from an uploaded/recorded clip.
 *
 * Cloned voices live at the provider (usable directly on a call) and are
 * mirrored into VoiceProfile so they show in the user's voice library across
 * the app. Cloning is metered — it's real work at the provider.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { cloneVoice } from "@/lib/voice-agent/xai-phone";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

// GET — the user's own cloned voices, for the import picker.
export async function GET() {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const profiles = await prisma.voiceProfile.findMany({
    where: { userId: session.userId, type: "cloned", openaiVoiceId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, gender: true, openaiVoiceId: true, sampleUrl: true, createdAt: true },
  });

  return NextResponse.json({
    success: true,
    voices: profiles.map((p) => ({
      profileId: p.id,
      voiceId: p.openaiVoiceId, // the provider voice id lives here
      name: p.name,
      gender: p.gender,
      sampleUrl: p.sampleUrl,
    })),
  });
}

// POST — clone from a clip. multipart/form-data: file, name, [gender], [language]
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "").trim();
    const gender = String(form.get("gender") || "").trim() || undefined;
    const language = String(form.get("language") || "en").trim() || "en";

    if (!(file instanceof Blob)) return fail("Add a voice clip to clone from.");
    if (!name) return fail("Give the voice a name.");
    if (file.size > 20 * 1024 * 1024) return fail("That clip is too large — keep it under 20 MB.");

    // Charge before the provider call, refund if it fails — same discipline as
    // number rental. Cloning is real work, not free.
    const cost = await getDynamicCreditCost("AI_VOICE_CLONE");
    const balance = await creditService.getBalance(session.userId);
    if (balance < cost) return fail(`Cloning a voice costs ${cost} credits — you have ${balance}.`);

    const charge = await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: cost,
      description: `Voice clone: ${name}`,
      referenceType: "voice_agent_clone",
    });
    if (!charge.success) return fail(charge.error || "Could not take the credits for cloning");

    const buf = Buffer.from(await file.arrayBuffer());
    const cloned = await cloneVoice({
      audio: buf,
      filename: (file as File).name || "voice.wav",
      contentType: file.type || "audio/wav",
      name,
      language,
      gender,
    });

    if (!cloned.ok) {
      await creditService.addCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.REFUND,
        amount: cost,
        description: `Refund — voice clone "${name}" failed`,
        referenceType: "voice_agent_clone_refund",
      });
      // Enterprise-gated create: point them at the console's 30 free instead of
      // a dead end.
      if (cloned.gated) {
        return fail(
          "Cloning by upload isn't enabled on this plan yet — you can still clone up to 30 voices in the voice console.",
          403,
        );
      }
      return fail(cloned.error || "Could not clone that voice", 502);
    }

    // Mirror into the user's library so it appears everywhere, not just here.
    const profile = await prisma.voiceProfile.create({
      data: {
        userId: session.userId,
        name,
        type: "cloned",
        gender: gender || null,
        openaiVoiceId: cloned.voiceId, // provider voice id
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      voice: { profileId: profile.id, voiceId: cloned.voiceId, name: cloned.name, gender },
    });
  } catch (error) {
    console.error("[VoiceAgent/clone] POST error:", error);
    return fail("Could not clone that voice", 500);
  }
}
