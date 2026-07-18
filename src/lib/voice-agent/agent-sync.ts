/**
 * Sync an app agent to a real xAI console agent — when the team's agents
 * endpoint is on.
 *
 * "Build both" (user's call): try to mirror the DB agent into a persistent xAI
 * agent; if the endpoint is off (or errors), fall back to the webhook + per-call
 * `session.update` path, which needs no console agent. Either way the agent can
 * answer — this only decides HOW a phone number is wired to it.
 *
 * Both the console agent and the per-call session are built from the SAME
 * `buildAgentSpec`/`buildSessionUpdate` source, so they can't drift.
 */

import { prisma } from "@/lib/db/client";
import { buildAgentSpec, type AgentForSession } from "@/lib/voice-agent/session-config";
import { syncXaiAgent } from "@/lib/voice-agent/xai-phone";

/** Parse a stored agent row into the shape the spec builder wants. */
export function toSessionAgent(row: Record<string, unknown>): AgentForSession {
  const j = <T,>(v: unknown, f: T): T => {
    try {
      return typeof v === "string" ? (JSON.parse(v) as T) : f;
    } catch {
      return f;
    }
  };
  return {
    name: String(row.name || "the business"),
    business: String(row.business || ""),
    greeting: String(row.greeting || ""),
    knowledge: j(row.knowledge, []),
    voiceId: String(row.voiceId || "eve"),
    speakingSpeed: Number(row.speakingSpeed ?? 1),
    languageHint: String(row.languageHint || "auto"),
    keyterms: j(row.keyterms, []),
    pronunciations: j(row.pronunciations, {}),
    reasoningEffort: String(row.reasoningEffort || "high"),
    allowInterrupt: Boolean(row.allowInterrupt ?? true),
    idleTimeoutMs: Number(row.idleTimeoutMs ?? 0),
    vadThreshold: Number(row.vadThreshold ?? 0.85),
    vadSilenceMs: Number(row.vadSilenceMs ?? 500),
    escalateTo: (row.escalateTo as string) || null,
    escalateOnUpset: Boolean(row.escalateOnUpset ?? true),
    escalateOnUnsure: Boolean(row.escalateOnUnsure ?? true),
    escalateOnAsk: Boolean(row.escalateOnAsk ?? true),
    noAnswerAction: String(row.noAnswerAction || "message"),
    discloseAi: Boolean(row.discloseAi ?? true),
    announceRecording: Boolean(row.announceRecording ?? true),
    recordCalls: Boolean(row.recordCalls ?? true),
    answerMode: String(row.answerMode || "always"),
    hours: j(row.hours, {}),
    timezone: String(row.timezone || "UTC"),
    skills: j(row.skills, []),
    orderConfig: j(row.orderConfig, { menuSource: "manual", items: [] }),
  } as unknown as AgentForSession;
}

export type SyncState = "synced" | "webhook" | "error";

/**
 * Mirror the agent to xAI. Records the result on the row and returns it. Never
 * throws — a sync failure must not block creating or editing an agent.
 */
export async function syncAgentToXai(agentId: string): Promise<{ state: SyncState; xaiAgentId?: string }> {
  const row = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!row) return { state: "error" };

  const spec = buildAgentSpec(toSessionAgent(row as unknown as Record<string, unknown>));

  let result;
  try {
    result = await syncXaiAgent(row.xaiAgentId, spec);
  } catch (e) {
    await mark(agentId, "error", { error: e instanceof Error ? e.message : "sync failed" });
    return { state: "error" };
  }

  if (result.ok) {
    await mark(agentId, "synced", { xaiAgentId: result.agentId });
    return { state: "synced", xaiAgentId: result.agentId };
  }
  if (result.notEnabled) {
    // The team hasn't turned the agents feature on — that's fine, the webhook
    // path answers calls without a console agent.
    await mark(agentId, "webhook", {});
    return { state: "webhook" };
  }
  await mark(agentId, "error", { error: result.error });
  return { state: "error" };
}

async function mark(
  agentId: string,
  state: SyncState,
  extra: { xaiAgentId?: string; error?: string },
) {
  await prisma.voiceAgent
    .update({
      where: { id: agentId },
      data: {
        xaiSyncState: state,
        xaiSyncError: extra.error ?? null,
        xaiSyncedAt: new Date(),
        ...(extra.xaiAgentId ? { xaiAgentId: extra.xaiAgentId } : {}),
      },
    })
    .catch(() => {
      /* recording the sync state must never throw */
    });
}
