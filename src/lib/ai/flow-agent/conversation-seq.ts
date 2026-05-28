import { prisma } from "@/lib/db/client";

/**
 * Per-conversation monotonic sequence counter.
 *
 * Used to stamp `AgentToolCall` and `AgentPlanProposal` rows with a
 * monotonically increasing `seq` per conversation. Clients use this for
 * the SSE-replay resume protocol — track the highest seq seen, send it
 * on reconnect, server returns rows with seq > N.
 *
 * The counter is computed as `MAX(seq) + 1` across the two existing
 * tables (tool calls + plan proposals) and the input is filtered by
 * conversationId. SQLite returns null when there are no rows; we fall
 * back to 1 for the first event in a conversation.
 *
 * Race condition note: under truly concurrent inserts in the same
 * conversation, two callers could read the same MAX and stamp the same
 * seq. This is fine for replay correctness — the client deduplicates by
 * row id, and `seq` ordering is still correct ASCENDING. We just allow
 * ties. If we ever need strict-monotonic (no ties), we'll add a
 * `nextSeq` column on AIConversation + use a transaction-bounded
 * UPDATE...RETURNING.
 */
export async function nextSeqForConversation(conversationId: string): Promise<number> {
  const [toolMax, planMax] = await Promise.all([
    prisma.agentToolCall.aggregate({
      where: { conversationId },
      _max: { seq: true },
    }),
    prisma.agentPlanProposal.aggregate({
      where: { conversationId },
      _max: { seq: true },
    }),
  ]);
  const current = Math.max(toolMax._max.seq ?? 0, planMax._max.seq ?? 0);
  return current + 1;
}
