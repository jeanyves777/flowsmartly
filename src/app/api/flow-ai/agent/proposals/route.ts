import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/flow-ai/agent/proposals?conversationId=X
 *
 * Returns every plan proposal for a conversation with its current status.
 *
 * Mobile / multi-device rehydration: when the chat thread reopens, the
 * UI fetches this so it can render every Confirm/Cancel card in its
 * actual state (no zombie pending buttons for proposals the other device
 * already confirmed, or that expired while the user was away).
 *
 * Also flips any newly-expired rows on read — cheap reconciliation
 * without a cron.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId: session.userId },
    select: { id: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Lazy-expire on read: anything past expiresAt that's still pending
  // gets flipped here in one update. Costs at most one round trip and
  // saves us a recurring cron.
  await prisma.agentPlanProposal.updateMany({
    where: {
      conversationId,
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired", resolvedAt: new Date() },
  });

  const rows = await prisma.agentPlanProposal.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      messageId: true,
      summary: true,
      steps: true,
      totalCreditCost: true,
      status: true,
      expiresAt: true,
      resolvedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    proposals: rows.map((r) => ({
      id: r.id,
      messageId: r.messageId,
      summary: r.summary,
      steps: safeJsonArray(r.steps),
      totalCreditCost: r.totalCreditCost,
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

function safeJsonArray(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
