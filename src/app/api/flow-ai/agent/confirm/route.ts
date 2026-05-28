import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveConfirmation } from "@/lib/ai/flow-agent/job-state";

/**
 * POST /api/flow-ai/agent/confirm — user clicks Confirm / Cancel on a
 * plan-proposal card. Wakes up the paused awaitConfirmation in the agent
 * stream. The agent's next loop iteration sees `{ confirmed: true|false }`
 * and proceeds (or doesn't).
 *
 * Body: { conversationId: string, planId: string, confirmed: boolean }
 *
 * The conversationId is validated against the planId's stored owner so
 * a forged request can't drive someone else's agent.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { conversationId?: string; planId?: string; confirmed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const planId = typeof body.planId === "string" ? body.planId : "";
  const confirmed = body.confirmed === true;
  if (!conversationId || !planId) {
    return NextResponse.json(
      { error: "conversationId and planId are required" },
      { status: 400 },
    );
  }

  // Make sure the caller actually owns this conversation.
  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId: session.userId },
    select: { id: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Make sure the proposal exists, belongs to this user, hasn't expired,
  // and hasn't already been resolved (idempotency + multi-device safety).
  const proposal = await prisma.agentPlanProposal.findUnique({
    where: { id: planId },
    select: { status: true, userId: true, expiresAt: true, conversationId: true },
  });
  if (!proposal || proposal.conversationId !== conversationId || proposal.userId !== session.userId) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if (proposal.status !== "pending") {
    // Already resolved (likely from the other device). Idempotent — tell the
    // caller the current state so its UI can update.
    return NextResponse.json({
      ok: true,
      delivered: false,
      status: proposal.status,
      message: `Proposal already ${proposal.status}.`,
    });
  }
  if (proposal.expiresAt.getTime() < Date.now()) {
    await prisma.agentPlanProposal.update({
      where: { id: planId },
      data: { status: "expired", resolvedAt: new Date() },
    });
    return NextResponse.json({
      ok: true,
      delivered: false,
      status: "expired",
      message: "Proposal expired.",
    });
  }

  // Flip DB state FIRST so any racing device sees the resolved status,
  // THEN wake the agent loop. The DB row is the source of truth; the
  // EventEmitter is just the wake-up signal.
  const nextStatus = confirmed ? "confirmed" : "rejected";
  await prisma.agentPlanProposal.update({
    where: { id: planId },
    data: { status: nextStatus, resolvedAt: new Date() },
  });
  const delivered = resolveConfirmation(planId, confirmed, conversationId);
  return NextResponse.json({ ok: true, delivered, status: nextStatus });
}
