import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/flow-ai/tasks?conversationId=X
 *
 * Returns every AgentTask for a conversation (or all of the user's tasks
 * if conversationId is omitted), with current status, output reference,
 * and timestamps.
 *
 * Mobile / multi-device rehydration: on chat reopen the UI fetches this
 * so any task that completed while the app was closed renders inline
 * with its final state ("✓ Video ready — tap to view").
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const statusFilter = searchParams.get("status"); // optional: pending | running | completed | failed | canceled
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

  const where: Record<string, unknown> = { userId: session.userId };
  if (conversationId) where.conversationId = conversationId;
  if (statusFilter) where.status = statusFilter;

  const tasks = await prisma.agentTask.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      conversationId: true,
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
  });

  return NextResponse.json({
    ok: true,
    tasks: tasks.map((t) => ({
      id: t.id,
      conversationId: t.conversationId,
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

function safeJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
