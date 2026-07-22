/**
 * Mirror a VoiceAgent row to a real ElevenLabs Conversational AI agent.
 *
 * Creates the EL agent on first sync (storing `elevenAgentId`) and patches it on
 * later edits, so the EL agent always reflects our DB. Never throws — a sync
 * failure is recorded on the row and must not block creating/editing an agent.
 */

import { prisma } from "@/lib/db/client";
import { buildElevenLabsAgent } from "@/lib/voice-agent/elevenlabs-agent-spec";
import { createConvaiAgent, updateConvaiAgent, isConvaiEnabled } from "@/lib/voice-agent/elevenlabs-convai";

export type ElevenSyncState = "synced" | "error";

export async function syncElevenLabsAgent(
  agentId: string,
): Promise<{ state: ElevenSyncState | "skipped"; elevenAgentId?: string }> {
  if (!isConvaiEnabled()) return { state: "skipped" };

  const row = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!row) return { state: "error" };

  const payload = buildElevenLabsAgent(row as unknown as Record<string, unknown>);
  const existingId = (row as unknown as { elevenAgentId?: string | null }).elevenAgentId || null;

  if (existingId) {
    const r = await updateConvaiAgent(existingId, payload);
    if (r.ok) return mark(agentId, "synced", { elevenAgentId: existingId });
    // The agent may have been deleted on EL's side — fall through to recreate.
    if (r.status !== 404) return mark(agentId, "error", { error: r.error });
  }

  const created = await createConvaiAgent(payload);
  if (!created.ok) return mark(agentId, "error", { error: created.error });
  return mark(agentId, "synced", { elevenAgentId: created.data.agent_id });
}

async function mark(
  agentId: string,
  state: ElevenSyncState,
  extra: { elevenAgentId?: string; error?: string },
): Promise<{ state: ElevenSyncState; elevenAgentId?: string }> {
  await prisma.voiceAgent
    .update({
      where: { id: agentId },
      data: {
        elevenSyncState: state,
        elevenSyncError: extra.error ?? null,
        elevenSyncedAt: new Date(),
        ...(extra.elevenAgentId ? { elevenAgentId: extra.elevenAgentId } : {}),
      },
    })
    .catch(() => {
      /* recording sync state must never throw */
    });
  return { state, elevenAgentId: extra.elevenAgentId };
}
