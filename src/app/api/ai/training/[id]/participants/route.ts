import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { canControlRoom, canManageRoles, canShareScreen } from "@/lib/training/access";
import { getTrainingActor } from "@/lib/training/guest";
import { getSessionDTO } from "@/lib/training/session";
import { broadcast, sendTo } from "@/lib/training/room";
import type { ParticipantRole } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

type Action =
  | "admit"
  | "deny"
  | "remove"
  | "promote" // → COHOST
  | "demote" // → TRAINEE
  | "grant_share"
  | "revoke_share"
  | "revoke_all_share"
  | "give_pen"
  | "take_pen"
  | "grant_draw"
  | "revoke_draw"
  | "mute"
  | "unmute"
  | "mute_all"
  | "cam_on"
  | "cam_off"
  | "start_share"
  | "stop_share"
  | "raise_hand"
  | "lower_hand";

/**
 * POST — every host control over a person, in one place.
 *
 * The two shapes stay distinct here, deliberately:
 *  - give_pen MOVES the pen (one holder; the old holder loses it)
 *  - grant_share ADDS a right (many may hold it; only one is on stage)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getTrainingActor(id);
  if (!actor) return err("Access denied", 403);

  const b = (await request.json().catch(() => ({}))) as { action?: Action; participantId?: string };
  const action = b.action;
  if (!action) return err("No action");

  const room = await prisma.trainingSession.findUnique({
    where: { id },
    select: { id: true, openShare: true, openMic: true, penHolderId: true, seats: true },
  });
  if (!room) return err("Not found", 404);

  const meId = actor.participantId;

  // Self-service actions a trainee (or guest) may take for themselves. Your own
  // camera is always yours — a host can't switch someone's camera ON for them.
  const SELF: Action[] = ["raise_hand", "lower_hand", "start_share", "stop_share", "mute", "unmute", "cam_on", "cam_off"];
  const isSelf = b.participantId === meId;
  if (!canControlRoom({ role: actor.role }) && !(isSelf && SELF.includes(action))) {
    return err("Only a host can do that", 403);
  }
  if ((action === "promote" || action === "demote") && !canManageRoles({ role: actor.role })) {
    return err("Only the room owner can change co-hosts", 403);
  }

  // Bulk actions don't need a target.
  if (action === "mute_all") {
    await prisma.trainingParticipant.updateMany({
      where: { sessionId: id, role: { in: ["TRAINEE", "GUEST"] } },
      data: { micOn: false },
    });
    return await push(id);
  }
  if (action === "revoke_all_share") {
    await prisma.trainingParticipant.updateMany({
      where: { sessionId: id, role: { in: ["TRAINEE", "GUEST"] } },
      data: { canShare: false, sharing: false },
    });
    await prisma.trainingSession.updateMany({
      where: { id, stageSource: "screen" },
      data: { stageSource: "board", stageKey: null },
    });
    return await push(id);
  }
  if (action === "take_pen") {
    // the pen comes back to whoever is asking (a host)
    await prisma.trainingSession.update({ where: { id }, data: { penHolderId: meId ?? null } });
    return await push(id);
  }

  const participantId = b.participantId;
  if (!participantId) return err("No participantId");

  const target = await prisma.trainingParticipant.findFirst({
    where: { id: participantId, sessionId: id },
  });
  if (!target) return err("No such participant", 404);
  if (target.role === "HOST" && (action === "remove" || action === "demote")) {
    return err("You can't remove the room owner");
  }

  switch (action) {
    case "admit": {
      const seated = await prisma.trainingParticipant.count({ where: { sessionId: id, state: "ADMITTED" } });
      if (seated >= room.seats) return err(`The room is full (${room.seats} seats)`);
      await prisma.trainingParticipant.update({
        where: { id: participantId },
        data: { state: "ADMITTED", joinedAt: target.joinedAt ?? new Date() },
      });
      // tell them personally — they're sitting on a "waiting to be let in" screen
      const dto = await getSessionDTO(id);
      const me = dto?.participants.find((p) => p.id === participantId);
      if (me) sendTo(id, participantId, { type: "room:participant", participant: me });
      break;
    }
    case "deny":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { state: "DENIED" } });
      break;
    case "remove":
      await prisma.trainingParticipant.update({
        where: { id: participantId },
        data: { state: "REMOVED", sharing: false, canShare: false, leftAt: new Date() },
      });
      if (room.penHolderId === participantId) {
        await prisma.trainingSession.update({ where: { id }, data: { penHolderId: meId ?? null } });
      }
      break;
    case "promote":
      // a co-host runs the room with you: they may share, draw and admit
      await prisma.trainingParticipant.update({
        where: { id: participantId },
        data: { role: "COHOST", canShare: true, canDraw: true },
      });
      break;
    case "demote":
      await prisma.trainingParticipant.update({
        where: { id: participantId },
        data: { role: "TRAINEE", canShare: false, canDraw: false },
      });
      break;
    case "grant_share":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { canShare: true } });
      break;
    case "revoke_share":
      await prisma.trainingParticipant.update({
        where: { id: participantId },
        data: { canShare: false, sharing: false },
      });
      // if they were the one on stage, the stage comes back to the board
      await prisma.trainingSession.updateMany({
        where: { id, stageSource: "screen", stageKey: participantId },
        data: { stageSource: "board", stageKey: null },
      });
      break;
    case "give_pen":
      // a handoff, not a grant — exactly one holder
      await prisma.trainingSession.update({ where: { id }, data: { penHolderId: participantId } });
      break;
    case "grant_draw":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { canDraw: true } });
      break;
    case "revoke_draw":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { canDraw: false } });
      break;
    case "mute":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { micOn: false } });
      break;
    case "unmute": {
      if (isSelf && !canControlRoom({ role: actor.role }) && !room.openMic) {
        return err("The host has muting on — raise your hand to speak");
      }
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { micOn: true } });
      break;
    }
    case "cam_on":
    case "cam_off": {
      // nobody turns your camera on but you
      if (action === "cam_on" && !isSelf) return err("Only they can turn their own camera on");
      await prisma.trainingParticipant.update({
        where: { id: participantId },
        data: { camOn: action === "cam_on" },
      });
      break;
    }
    case "start_share": {
      const asDto = { role: target.role as ParticipantRole, canShare: target.canShare };
      if (!canShareScreen(asDto, { openShare: room.openShare })) {
        return err("You can't share your screen in this room yet");
      }
      // one screen on the stage at a time
      await prisma.trainingParticipant.updateMany({ where: { sessionId: id, sharing: true }, data: { sharing: false } });
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { sharing: true } });
      await prisma.trainingSession.update({
        where: { id },
        data: { stageSource: "screen", stageKey: participantId },
      });
      break;
    }
    case "stop_share":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { sharing: false } });
      await prisma.trainingSession.updateMany({
        where: { id, stageSource: "screen", stageKey: participantId },
        data: { stageSource: "board", stageKey: null },
      });
      break;
    case "raise_hand":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { handRaised: true } });
      break;
    case "lower_hand":
      await prisma.trainingParticipant.update({ where: { id: participantId }, data: { handRaised: false } });
      break;
    default:
      return err("Unknown action");
  }

  return await push(id);
}

/** Re-read and fan the change out, so every screen in the room agrees. */
async function push(id: string) {
  const dto = await getSessionDTO(id);
  if (dto) {
    broadcast(id, {
      type: "room:state",
      patch: {
        participants: dto.participants,
        penHolderId: dto.penHolderId,
        stageSource: dto.stageSource,
        stageKey: dto.stageKey,
        openShare: dto.openShare,
        openMic: dto.openMic,
      },
    });
  }
  return NextResponse.json({ success: true, data: { session: dto } });
}
