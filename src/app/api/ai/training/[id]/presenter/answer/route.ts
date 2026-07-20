import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getTrainingActor } from "@/lib/training/guest";
import { canControlRoom } from "@/lib/training/access";
import { broadcast } from "@/lib/training/room";
import { ai } from "@/lib/ai/client";
import { synthesize } from "@/lib/training/narration";
import { creditService } from "@/lib/credits";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";
import type { PresenterAnswer, TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 120;
const ANSWER_COST = 6; // one AI answer + a short TTS reply

/**
 * POST /api/ai/training/[id]/presenter/answer — a live Q&A turn. Any admitted
 * participant may ask; the AI presenter answers ONLY from the training content (slides,
 * notes, what it already said), voices the reply in the presenter's voice, and hands off
 * to the host when it isn't confident. Broadcast to the room; the narration pauses so
 * the answer isn't talked over. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getTrainingActor(id);
  if (!actor || actor.state !== "ADMITTED") return err("You're not in the room yet", 403);

  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = (body.question || "").trim().slice(0, 400);
  if (question.length < 3) return err("Ask a question first");

  const asker = await prisma.trainingParticipant.findUnique({ where: { id: actor.participantId }, select: { name: true } });

  const room = await prisma.trainingSession.findUnique({ where: { id }, select: { userId: true, title: true, materials: { where: { kind: "slides" }, select: { deck: true } } } });
  if (!room) return err("Not found", 404);

  // Find the active-presenter deck; gather its knowledge.
  let deck: TrainingDeck | null = null;
  for (const m of room.materials) {
    if (!m.deck) continue;
    try { const d = JSON.parse(m.deck) as TrainingDeck; if (d.presenterActive && d.presenterId) { deck = d; break; } } catch { /* skip */ }
  }
  if (!deck) return err("The AI presenter isn't set up for this room");

  const presenter = await prisma.presenterProfile.findFirst({ where: { id: deck.presenterId ?? undefined }, select: { name: true, deliveryStyle: true, pace: true, voiceProfileId: true, userId: true } });
  if (!presenter || presenter.userId !== room.userId) return err("Presenter unavailable", 404);
  const voice = presenter.voiceProfileId
    ? await prisma.voiceProfile.findFirst({ where: { id: presenter.voiceProfileId }, select: { openaiVoiceId: true, elevenLabsVoiceId: true } })
    : null;

  const knowledge = deck.slides.map((s, i) => {
    const labels = (s.board ?? []).filter((b) => b.t === "text").map((b) => (b as { text: string }).text);
    return `[Slide ${i + 1}: ${s.title}] ${[s.subtitle, ...(s.bullets ?? []), s.notes, labels.length ? `Diagram: ${labels.join(" → ")}` : "", s.narration?.text].filter(Boolean).join(" ")}`;
  }).join("\n").slice(0, 6000);

  // Charge the room owner (the answer costs an AI call + TTS).
  const charge = await creditService.deductCredits({ userId: room.userId, type: "USAGE", amount: ANSWER_COST, description: "Training Room: presenter answer", referenceType: "presenter_answer", referenceId: id });
  if (!charge.success) return err("The room is out of credits for live answers", 402);
  const refund = () => creditService.addCredits?.({ userId: room.userId, type: "REFUND", amount: ANSWER_COST, description: "Refund: presenter answer failed", referenceType: "presenter_answer", referenceId: id }).catch(() => {});

  try {
    const prompt = `You are ${presenter.name}, the AI co-host delivering the training "${room.title}". A participant just asked, out loud:

"${question}"

Answer ONLY from the training content below — do NOT invent facts or use outside knowledge. Reply the way you'd say it aloud: 2-4 warm, clear sentences, first person. If the content does not clearly cover the question, set "confident" to false and give a brief graceful hand-off instead of guessing.

TRAINING CONTENT:
${knowledge}

Return JSON: { "answer": string, "confident": boolean }`;

    const res = (await ai.generateJSON<{ answer?: string; confident?: boolean }>(prompt, { temperature: 0.4, maxTokens: 400 }))
      ?? { answer: "", confident: false };
    const confident = res.confident === true && !!res.answer?.trim();
    const answerText = (confident
      ? res.answer!.trim()
      : `That's a great question — let me hand that to your host to add the detail it deserves.`).slice(0, 700);

    let audioUrl: string | null = null;
    let durationMs = 0;
    try {
      const { buffer, durationMs: d } = await synthesize(answerText, voice, presenter.pace ?? 1, presenter.deliveryStyle ?? "conversational");
      audioUrl = await uploadToS3(`training/${id}/answers/${nanoid(8)}.mp3`, buffer, "audio/mpeg");
      durationMs = d;
    } catch { /* text-only answer if TTS is unavailable */ }

    const answer: PresenterAnswer = { id: nanoid(8), question, askedBy: asker?.name || "Someone", answer: answerText, audioUrl, durationMs, confident };

    // Pause the narration so the answer isn't talked over, then announce it.
    await prisma.trainingSession.update({ where: { id }, data: { aiPlaying: false } }).catch(() => {});
    broadcast(id, { type: "room:state", patch: { aiPlaying: false } });
    broadcast(id, { type: "presenter:answer", answer });

    return NextResponse.json({ success: true, data: { answer } });
  } catch {
    await refund();
    return err("The presenter couldn't answer that — try rephrasing", 502);
  }
}

/** DELETE — the host dismisses the current Q&A / hand-raise card for the whole room. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getTrainingActor(id);
  if (!actor || actor.state !== "ADMITTED" || !canControlRoom({ role: actor.role })) return err("Only a host can dismiss that", 403);
  broadcast(id, { type: "presenter:dismiss" });
  return NextResponse.json({ success: true });
}
