import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { narrateDeck, type NarrateResult } from "@/lib/training/narration";
import { getSessionDTO } from "@/lib/training/session";
import type { TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300; // scripts + TTS for a whole deck can take a bit
const BASE = 4;      // writing the scripts (one AI call)
const PER_SLIDE = 4; // synthesizing one slide's narration

/**
 * POST /api/ai/training/[id]/deck/narrate — generate spoken narration for a deck in
 * the active presenter's voice + delivery style, and store it on each slide. Charges
 * the max up front, refunds for slides that didn't get audio. { materialId }.
 * [[training-studio]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => ({}))) as { materialId?: string };
  if (!body.materialId) return err("Nothing to narrate");

  // host-only: the material must belong to a session this user owns
  const mat = await prisma.trainingMaterial.findFirst({
    where: { id: body.materialId, session: { userId: session.userId } },
    select: { id: true, sessionId: true, deck: true, session: { select: { plannedMins: true } } },
  });
  if (!mat?.deck) return err("That deck no longer exists", 404);

  let deck: TrainingDeck;
  try { deck = JSON.parse(mat.deck) as TrainingDeck; } catch { return err("That deck can't be read", 500); }
  if (!deck.slides?.length) return err("This deck has no slides yet");
  if (!deck.presenterId) return err("Add an AI presenter to this presentation first");

  const presenter = await prisma.presenterProfile.findFirst({
    where: { id: deck.presenterId, userId: session.userId },
    select: { name: true, deliveryStyle: true, pace: true, voiceProfileId: true },
  });
  if (!presenter) return err("That presenter no longer exists", 404);
  const voice = presenter.voiceProfileId
    ? await prisma.voiceProfile.findFirst({ where: { id: presenter.voiceProfileId, userId: session.userId }, select: { openaiVoiceId: true, elevenLabsVoiceId: true } })
    : null;

  const maxCharge = BASE + deck.slides.length * PER_SLIDE;
  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: maxCharge, description: "Training Room: presenter narration", referenceType: "presenter_narration", referenceId: mat.sessionId });
  if (!charge.success) return err(charge.error || "Not enough credits to generate narration", 402);
  const refund = async (n: number) => { if (n > 0) await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: n, description: "Refund: unused narration credits", referenceType: "presenter_narration", referenceId: mat.sessionId }).catch(() => {}); };

  let result: NarrateResult = { narrations: {}, reveals: {}, cloneRequested: false, cloneUsed: false };
  try {
    result = await narrateDeck({ slides: deck.slides, sessionId: mat.sessionId, voice, pace: presenter.pace ?? 1, style: presenter.deliveryStyle ?? "conversational", presenterName: presenter.name, minutes: mat.session?.plannedMins });
  } catch (e) { console.error("[narrate] failed:", e instanceof Error ? e.message : e); await refund(maxCharge); return err("Couldn't generate the narration — try again", 502); }

  const narrations = result.narrations;
  const count = Object.keys(narrations).length;
  await refund(maxCharge - (BASE + count * PER_SLIDE));
  if (!count) return err("Couldn't voice the slides just now — please try again in a moment.", 502);

  const reveals = result.reveals;
  deck.slides = deck.slides.map((s) => {
    let out = s;
    if (narrations[s.id]) out = { ...out, narration: narrations[s.id] };
    if (reveals[s.id]) out = { ...out, quizReveal: reveals[s.id] };
    return out;
  });
  await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });

  // if a cloned voice was requested but couldn't be reached, the audio used a preset —
  // tell the client so it can say so instead of implying it's the presenter's own voice.
  const usedPreset = result.cloneRequested && !result.cloneUsed;
  return NextResponse.json({ success: true, data: { session: await getSessionDTO(mat.sessionId), narrated: count, usedPreset } });
}
