import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getTrainingActor } from "@/lib/training/guest";
import { broadcast } from "@/lib/training/room";
import type { TrainingMessageDTO } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST — send an in-meeting chat message.
 *
 * Read is the SSE room stream (the first frame carries recent history); this is
 * the write half. Only an ADMITTED participant (logged-in or guest, resolved by
 * getTrainingActor) may post. The message is persisted so late joiners see it,
 * then fanned out as a `chat` event. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getTrainingActor(id);
  if (!actor) return err("Access denied", 403);
  if (actor.state !== "ADMITTED") return err("You're not in the room yet", 403);

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || "").replace(/\s+$/g, "").slice(0, 1000);
  if (!text.trim()) return err("Say something first");

  // The display name is captured at send time — guests have no account.
  const me = await prisma.trainingParticipant.findUnique({
    where: { id: actor.participantId },
    select: { name: true },
  });

  const row = await prisma.trainingMessage.create({
    data: { sessionId: id, participantId: actor.participantId, name: me?.name || "Someone", text },
    select: { id: true, participantId: true, name: true, text: true, createdAt: true },
  });

  const message: TrainingMessageDTO = {
    id: row.id,
    participantId: row.participantId,
    name: row.name,
    text: row.text,
    at: row.createdAt.toISOString(),
  };
  broadcast(id, { type: "chat", message });

  return NextResponse.json({ success: true, data: { message } });
}
