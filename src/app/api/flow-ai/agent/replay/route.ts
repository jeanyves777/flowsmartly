import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/flow-ai/agent/replay?conversationId=X&lastSeq=N
 *
 * Catch-up endpoint for SSE recovery. When the client's main agent
 * stream drops (subway, sleep, tab unfocus → throttled, etc.) it
 * reconnects with the last `seq` it received, and this endpoint returns
 * all tool calls + plan proposals + tasks for that conversation with
 * seq > N — in order.
 *
 * Currently uses `createdAt` ordering when `seq` is 0 across the row
 * (Phase 1 hasn't started actually populating the seq column yet — the
 * column is reserved for a future round of work). For now `createdAt`
 * is a good-enough monotonic stand-in: rows ordered by createdAt give
 * the same effective replay because the agent loop writes them serially.
 *
 * This is the safe scaffolding for the mobile-resilience scenario the
 * user called out 2026-05-27. Pair it with a client-side reconnect
 * loop that:
 *   1. on disconnect, picks the highest seq it has seen
 *   2. calls /replay with lastSeq=that
 *   3. applies returned events
 *   4. (Phase 4) reopens the live stream — for now the client just
 *      re-POSTs a fresh message when the user types again.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }
  const lastSeq = Math.max(0, Number(searchParams.get("lastSeq") ?? 0));
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 200)));

  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId: session.userId },
    select: { id: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Pull the three event sources in parallel.
  const [toolCalls, proposals, tasks] = await Promise.all([
    prisma.agentToolCall.findMany({
      where: {
        conversationId,
        OR: [{ seq: { gt: lastSeq } }, { seq: 0 }],
      },
      orderBy: [{ seq: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        messageId: true,
        toolName: true,
        output: true,
        errorCode: true,
        creditCost: true,
        durationMs: true,
        seq: true,
        createdAt: true,
      },
    }),
    prisma.agentPlanProposal.findMany({
      where: {
        conversationId,
        OR: [{ seq: { gt: lastSeq } }, { seq: 0 }],
      },
      orderBy: [{ seq: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        messageId: true,
        summary: true,
        steps: true,
        totalCreditCost: true,
        status: true,
        expiresAt: true,
        resolvedAt: true,
        seq: true,
        createdAt: true,
      },
    }),
    prisma.agentTask.findMany({
      where: {
        conversationId,
        // Tasks don't have a seq column — replay everything from the
        // conversation. The client deduplicates by task id.
        createdAt: { gt: lastSeq > 0 ? undefined : undefined },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        messageId: true,
        kind: true,
        status: true,
        output: true,
        error: true,
        resultRefType: true,
        resultRefId: true,
        creditCost: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    }),
  ]);

  // Compute the highest seq across the returned event sources so the
  // client can store it as its new high-water mark.
  const highestSeq = Math.max(
    lastSeq,
    ...toolCalls.map((t) => t.seq ?? 0),
    ...proposals.map((p) => p.seq ?? 0),
  );

  return NextResponse.json({
    ok: true,
    conversationId,
    lastSeq: highestSeq,
    counts: {
      toolCalls: toolCalls.length,
      proposals: proposals.length,
      tasks: tasks.length,
    },
    toolCalls: toolCalls.map((t) => ({
      id: t.id,
      messageId: t.messageId,
      toolName: t.toolName,
      output: safeJson(t.output),
      errorCode: t.errorCode,
      creditCost: t.creditCost,
      durationMs: t.durationMs,
      seq: t.seq,
      createdAt: t.createdAt.toISOString(),
    })),
    proposals: proposals.map((p) => ({
      id: p.id,
      messageId: p.messageId,
      summary: p.summary,
      steps: safeArray(p.steps),
      totalCreditCost: p.totalCreditCost,
      status: p.status,
      expiresAt: p.expiresAt.toISOString(),
      resolvedAt: p.resolvedAt?.toISOString() ?? null,
      seq: p.seq,
      createdAt: p.createdAt.toISOString(),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      messageId: t.messageId,
      kind: t.kind,
      status: t.status,
      output: t.output ? safeJson(t.output) : null,
      error: t.error,
      resultRefType: t.resultRefType,
      resultRefId: t.resultRefId,
      creditCost: t.creditCost,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

function safeJson(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeArray(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
