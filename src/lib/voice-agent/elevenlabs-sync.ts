/**
 * Mirror a VoiceAgent row to a real ElevenLabs Conversational AI agent.
 *
 * Creates the EL agent on first sync (storing `elevenAgentId`) and patches it on
 * later edits, so the EL agent — its prompt, voice, language, and inline webhook
 * tools — always reflects our DB. Never throws; a sync failure is recorded on the
 * row and must not block creating/editing an agent.
 */

import { prisma } from "@/lib/db/client";
import { buildElevenLabsAgent } from "@/lib/voice-agent/elevenlabs-agent-spec";
import { assignConvaiNumberToAgent, createConvaiAgent, updateConvaiAgent, isConvaiEnabled } from "@/lib/voice-agent/elevenlabs-convai";

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
    const upd = await updateConvaiAgent(existingId, payload);
    if (upd.ok) return mark(agentId, "synced", { elevenAgentId: existingId });
    // The agent may have been deleted on EL's side — fall through to recreate.
    if (upd.status !== 404) return mark(agentId, "error", { error: upd.error });
  }

  const created = await createConvaiAgent(payload);
  if (!created.ok) return mark(agentId, "error", { error: created.error });
  const newAgentId = created.data.agent_id;

  // The EL agent was RE-CREATED (the old one 404'd). Any phone number that was
  // bound to the OLD agent id now points at a dead agent, so INBOUND calls never
  // reach us and never create a conversation to import — this is why inbound calls
  // silently vanished from the log after a re-create. Re-bind the number to the new id.
  await rebindNumber(row as unknown as { phoneNumberId?: string | null }, newAgentId).catch(() => {});

  return mark(agentId, "synced", { elevenAgentId: newAgentId });
}

/** After a re-create, point the agent's phone number at the new EL agent id so
 *  inbound calls route to it. No-op if the agent has no number provisioned on EL. */
async function rebindNumber(row: { phoneNumberId?: string | null }, elevenAgentId: string): Promise<void> {
  if (!row.phoneNumberId) return;
  const num = await prisma.phoneNumber
    .findUnique({ where: { id: row.phoneNumberId }, select: { elevenPhoneNumberId: true } })
    .catch(() => null);
  if (num?.elevenPhoneNumberId) {
    await assignConvaiNumberToAgent(num.elevenPhoneNumberId, elevenAgentId).catch(() => {});
  }
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
