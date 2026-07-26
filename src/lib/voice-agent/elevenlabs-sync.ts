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
import { assignConvaiNumberToAgent, createConvaiAgent, createKnowledgeBaseUrl, updateConvaiAgent, isConvaiEnabled } from "@/lib/voice-agent/elevenlabs-convai";

export type ElevenSyncState = "synced" | "error";

export async function syncElevenLabsAgent(
  agentId: string,
): Promise<{ state: ElevenSyncState | "skipped"; elevenAgentId?: string }> {
  if (!isConvaiEnabled()) return { state: "skipped" };

  const row = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!row) return { state: "error" };

  // Make the business's knowledge (URLs) into ElevenLabs knowledge-base docs and
  // cache their ids on the row, so the agent can ANSWER from the real content
  // (RAG) instead of just knowing the source names. Best-effort; never blocks sync.
  await ensureKnowledgeDocs(row as unknown as { id: string; knowledge?: unknown; knowledgeDocs?: unknown }).catch(() => {});

  const payload = buildElevenLabsAgent(row as unknown as Record<string, unknown>);
  const existingId = (row as unknown as { elevenAgentId?: string | null }).elevenAgentId || null;

  if (existingId) {
    const upd = await updateConvaiAgent(existingId, payload);
    if (upd.ok) {
      // Rebind on EVERY sync (idempotent PATCH). If a past re-create left the number
      // bound to a DEAD agent id, inbound calls never reach us — this heals that on
      // the next save instead of waiting for another re-create.
      await rebindNumber(row as unknown as { phoneNumberId?: string | null }, existingId).catch(() => {});
      return mark(agentId, "synced", { elevenAgentId: existingId });
    }
    // The agent may have been deleted on EL's side — fall through to recreate.
    if (upd.status !== 404) return mark(agentId, "error", { error: upd.error });
  }

  const created = await createConvaiAgent(payload);
  if (!created.ok) return mark(agentId, "error", { error: created.error });
  const newAgentId = created.data.agent_id;

  // The EL agent was RE-CREATED (the old one 404'd). Any phone number bound to the
  // OLD id now points at a dead agent, so inbound never reaches us — re-bind it.
  await rebindNumber(row as unknown as { phoneNumberId?: string | null }, newAgentId).catch(() => {});

  return mark(agentId, "synced", { elevenAgentId: newAgentId });
}

type KbDoc = { url: string; id: string; name: string };
const jp = <T,>(v: unknown, f: T): T => {
  try { return typeof v === "string" ? (JSON.parse(v) as T) : f; } catch { return f; }
};

/** Ensure every knowledge URL is an ElevenLabs knowledge-base doc, caching the ids
 *  on the row so each is created only once. Prunes docs whose URL was removed.
 *  Best-effort — a failed doc is simply skipped (the agent still works). */
async function ensureKnowledgeDocs(row: { id: string; knowledge?: unknown; knowledgeDocs?: unknown }): Promise<void> {
  const items = jp<{ kind?: string; label?: string; url?: string }[]>(row.knowledge, []);
  const urls = items.map((k) => (k.url || "").trim()).filter((u) => /^https?:\/\//i.test(u));
  let docs = jp<KbDoc[]>(row.knowledgeDocs, []);
  const before = docs.length;

  // Drop docs whose URL is no longer in the knowledge list.
  const wanted = new Set(urls);
  docs = docs.filter((d) => wanted.has(d.url));
  let changed = docs.length !== before;

  // Create any missing.
  const have = new Set(docs.map((d) => d.url));
  for (const k of items) {
    const u = (k.url || "").trim();
    if (!/^https?:\/\//i.test(u) || have.has(u)) continue;
    const r = await createKnowledgeBaseUrl(u, (k.label || u).slice(0, 80));
    if (r.ok) { docs.push({ url: u, id: r.data.id, name: r.data.name || k.label || u }); have.add(u); changed = true; }
  }

  if (changed) {
    const json = JSON.stringify(docs);
    await prisma.voiceAgent.update({ where: { id: row.id }, data: { knowledgeDocs: json } }).catch(() => {});
    row.knowledgeDocs = json; // keep the in-memory row fresh for buildElevenLabsAgent
  }
}

/** Point the agent's phone number at its current EL agent id so inbound calls route
 *  to it. Idempotent (a no-op PATCH when already correct); no-op if no EL number. */
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
