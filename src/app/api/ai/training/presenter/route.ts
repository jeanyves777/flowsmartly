import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isElevenLabsEnabled } from "@/lib/voice/elevenlabs-client";
import { isOpenAIVoiceCloningEnabled } from "@/lib/voice/openai-voice-client";
import type { PresenterProfileDTO, PresenterQuestionBehavior } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

type PresenterRow = NonNullable<Awaited<ReturnType<typeof prisma.presenterProfile.findFirst>>> & {
  voice?: { name: string } | null;
};

function toDTO(p: PresenterRow): PresenterProfileDTO {
  let qb: PresenterQuestionBehavior | null = null;
  try { qb = p.questionBehavior ? (JSON.parse(p.questionBehavior) as PresenterQuestionBehavior) : null; } catch { qb = null; }
  return {
    id: p.id,
    name: p.name,
    portraitUrl: p.portraitUrl,
    loopVideoUrl: p.loopVideoUrl,
    introVideoUrl: p.introVideoUrl,
    outroVideoUrl: p.outroVideoUrl,
    voiceProfileId: p.voiceProfileId,
    voiceName: p.voice?.name ?? null,
    deliveryStyle: p.deliveryStyle as PresenterProfileDTO["deliveryStyle"],
    pace: p.pace,
    expressiveness: p.expressiveness,
    pauseMs: p.pauseMs,
    role: p.role as PresenterProfileDTO["role"],
    followNotes: p.followNotes,
    describeVisuals: p.describeVisuals,
    advanceReveals: p.advanceReveals,
    useLiveDraw: p.useLiveDraw,
    questionBehavior: qb,
    consentAcceptedAt: p.consentAcceptedAt ? p.consentAcceptedAt.toISOString() : null,
    consentOwnerName: p.consentOwnerName,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * GET /api/ai/training/presenter — the user's reusable AI presenter profiles, plus
 * their cloned voices to pick from and whether new cloning is available right now.
 * [[training-studio]]
 */
export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const [presenters, voices] = await Promise.all([
    prisma.presenterProfile.findMany({
      where: { userId: session.userId },
      include: { voice: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.voiceProfile.findMany({
      where: { userId: session.userId, type: "cloned" },
      select: { id: true, name: true, elevenLabsVoiceId: true, openaiVoiceId: true, sampleUrl: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      presenters: presenters.map((p) => toDTO(p as PresenterRow)),
      voices: voices.map((v) => ({ id: v.id, name: v.name, provider: v.elevenLabsVoiceId ? "elevenlabs" : v.openaiVoiceId ? "openai" : null, sampleUrl: v.sampleUrl })),
      voiceCloning: { available: isElevenLabsEnabled() || isOpenAIVoiceCloningEnabled(), provider: isElevenLabsEnabled() ? "elevenlabs" : isOpenAIVoiceCloningEnabled() ? "openai" : null },
    },
  });
}

interface Body {
  id?: string;
  name?: string;
  portraitUrl?: string | null;
  voiceProfileId?: string | null;
  deliveryStyle?: string;
  pace?: number;
  expressiveness?: number;
  pauseMs?: number;
  role?: string;
  followNotes?: boolean;
  describeVisuals?: boolean;
  advanceReveals?: boolean;
  useLiveDraw?: boolean;
  questionBehavior?: PresenterQuestionBehavior;
  consent?: { accepted?: boolean; ownerName?: string; usage?: string };
}

/**
 * POST /api/ai/training/presenter — create or update an AI presenter profile.
 *
 * Cloning a real person requires explicit voice-owner consent: a new presenter must
 * arrive with `consent.accepted` and an `ownerName`. Editing an existing one keeps
 * the consent already on file.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const b = (await request.json().catch(() => ({}))) as Body;
  const name = (b.name || "").trim();
  if (name.length < 1 || name.length > 80) return err("Give your presenter a name");

  const STYLES = ["professional", "conversational", "energetic", "teacher"];
  const ROLES = ["cohost", "host", "assistant"];
  const data = {
    name,
    portraitUrl: b.portraitUrl ?? null,
    voiceProfileId: b.voiceProfileId ?? null,
    deliveryStyle: STYLES.includes(b.deliveryStyle || "") ? b.deliveryStyle! : "conversational",
    pace: typeof b.pace === "number" ? Math.min(2, Math.max(0.5, b.pace)) : 1,
    expressiveness: typeof b.expressiveness === "number" ? Math.min(100, Math.max(0, Math.round(b.expressiveness))) : 65,
    pauseMs: typeof b.pauseMs === "number" ? Math.min(4000, Math.max(0, Math.round(b.pauseMs))) : 1200,
    role: ROLES.includes(b.role || "") ? b.role! : "cohost",
    followNotes: b.followNotes ?? true,
    describeVisuals: b.describeVisuals ?? true,
    advanceReveals: b.advanceReveals ?? true,
    useLiveDraw: b.useLiveDraw ?? true,
    questionBehavior: b.questionBehavior ? JSON.stringify(b.questionBehavior) : undefined,
  };

  // If a voice was chosen, it must belong to this user.
  if (data.voiceProfileId) {
    const owned = await prisma.voiceProfile.findFirst({ where: { id: data.voiceProfileId, userId: session.userId }, select: { id: true } });
    if (!owned) return err("That voice isn't available");
  }

  let row;
  if (b.id) {
    const existing = await prisma.presenterProfile.findFirst({ where: { id: b.id, userId: session.userId }, select: { id: true } });
    if (!existing) return err("That presenter no longer exists", 404);
    row = await prisma.presenterProfile.update({ where: { id: b.id }, data, include: { voice: { select: { name: true } } } });
  } else {
    // New presenter — require explicit consent.
    if (!b.consent?.accepted || !(b.consent.ownerName || "").trim()) {
      return err("Confirm you own this voice and likeness before creating a presenter");
    }
    row = await prisma.presenterProfile.create({
      data: {
        ...data,
        userId: session.userId,
        consentAcceptedAt: new Date(),
        consentOwnerName: b.consent.ownerName!.trim().slice(0, 120),
        consentUsage: (b.consent.usage || "training_presentations").slice(0, 120),
      },
      include: { voice: { select: { name: true } } },
    });
  }

  return NextResponse.json({ success: true, data: { presenter: toDTO(row as PresenterRow) } });
}

/**
 * DELETE /api/ai/training/presenter?id=…[&deleteVoice=1] — remove a presenter
 * profile (and optionally its cloned voice) immediately, per the consent contract.
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return err("Nothing to delete");

  const p = await prisma.presenterProfile.findFirst({ where: { id, userId: session.userId }, select: { id: true, voiceProfileId: true } });
  if (!p) return err("That presenter no longer exists", 404);

  await prisma.presenterProfile.delete({ where: { id: p.id } });
  if (searchParams.get("deleteVoice") === "1" && p.voiceProfileId) {
    await prisma.voiceProfile.deleteMany({ where: { id: p.voiceProfileId, userId: session.userId } }).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
