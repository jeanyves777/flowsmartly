import { prisma } from "@/lib/db/client";
import { broadcast } from "@/lib/training/room";
import type { TrainingParticipantDTO } from "@/lib/training/types";

/**
 * Put the AI Presenter into the room as a disclosed co-host — a synthetic participant (isAI),
 * never a real media connection. It appears in the roster whenever the deck HAS a co-host
 * presence: a presenter profile is attached AND either the presenter is active OR the deck
 * carries any baked co-host / intro / moment / outro talking video. So a training built with
 * per-slide co-host videos always shows the co-host in "In the room", even if the global
 * moving-avatar presenter toggle is off. Idempotent: updates the existing AI co-host or creates
 * one, then announces it over SSE. [[training-studio]] [[training-presenter-talking-video]]
 */
export async function ensureAICohost(sessionId: string): Promise<void> {
  const mats = await prisma.trainingMaterial.findMany({ where: { sessionId, kind: "slides" }, select: { deck: true } });
  let presenterId: string | null = null;
  for (const m of mats) {
    if (!m.deck) continue;
    try {
      const d = JSON.parse(m.deck) as {
        presenterActive?: boolean; presenterId?: string; presenterVideoUrl?: string;
        introVideoUrl?: string; outroVideoUrl?: string;
        slides?: Array<{ cohostVideoUrl?: string; momentVideoUrl?: string }>;
      };
      if (!d.presenterId) continue;
      const hasCohostVideo = !!(d.presenterVideoUrl || d.introVideoUrl || d.outroVideoUrl)
        || (Array.isArray(d.slides) && d.slides.some((s) => s?.cohostVideoUrl || s?.momentVideoUrl));
      if (d.presenterActive || hasCohostVideo) { presenterId = d.presenterId; break; }
    } catch { /* skip a malformed deck */ }
  }
  if (!presenterId) return;

  const presenter = await prisma.presenterProfile.findUnique({ where: { id: presenterId }, select: { name: true, portraitUrl: true } });
  if (!presenter) return;

  const existing = await prisma.trainingParticipant.findFirst({ where: { sessionId, isAI: true } });
  const data = { name: presenter.name, avatarUrl: presenter.portraitUrl, role: "COHOST", state: "ADMITTED", presenterProfileId: presenterId, canShare: true, canDraw: true, camOn: true };
  const p = existing
    ? await prisma.trainingParticipant.update({ where: { id: existing.id }, data })
    : await prisma.trainingParticipant.create({ data: { sessionId, isAI: true, joinedAt: new Date(), ...data } });

  const dto: TrainingParticipantDTO = {
    id: p.id, userId: p.userId, name: p.name, email: p.email, avatarUrl: p.avatarUrl,
    role: "COHOST", state: "ADMITTED", canShare: p.canShare, canDraw: p.canDraw,
    micOn: p.micOn, camOn: p.camOn, handRaised: p.handRaised, sharing: p.sharing,
    joinedAt: p.joinedAt?.toISOString() ?? null, focusPct: p.focusPct, secondsIn: p.secondsIn, isAI: true,
  };
  broadcast(sessionId, { type: "room:join", participant: dto });
}
