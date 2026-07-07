import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

// Mirrors edit-pitch-field.ts — the fields the agent can actually rewrite.
const STRING_FIELDS = ["title", "subtitle", "serviceTitle", "executiveSummary", "aboutBrand", "clientNeed", "preparedFor", "preparedBy", "subject"];
const LIST_FIELDS = ["commitments", "benefits", "nextSteps", "terms"];

/**
 * get_pitch — READ one proposal's CURRENT editable content by pitchId, so the
 * agent can see what the OPEN proposal actually says before rewriting/shortening
 * it (list_pitches only returns metadata; this returns the field text). The
 * companion to edit_pitch_field. Read-only, free.
 * [[proposal-pdf-mirrors-studio]] [[agent-operates-account-full-crud]]
 */
export const getPitch: FlowAgentTool = {
  name: "get_pitch",
  description:
    "READ the CURRENT content of ONE proposal/pitch by pitchId — returns its editable fields with their present text: strings (title, subtitle, serviceTitle, executiveSummary, aboutBrand, clientNeed, preparedFor, preparedBy, subject) and bullet lists (commitments, benefits, nextSteps, terms). Call this FIRST whenever the user asks to shorten, tighten, rewrite, or restructure the OPEN proposal — you need to see what it currently says, then rewrite the wordy fields with edit_pitch_field. Read-only, free.",
  input_schema: {
    type: "object",
    properties: {
      pitchId: { type: "string", description: "The proposal's id (the surfaceContext gives you the one the user has OPEN)." },
    },
    required: ["pitchId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    if (!pitchId) return { ok: false, error_code: "missing_input", message: "pitchId is required." };
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, userId: ctx.userId },
      select: { id: true, businessName: true, documentType: true, pitchContent: true },
    });
    if (!pitch) return { ok: false, error_code: "not_found", message: "That proposal was not found." };

    let content: Record<string, unknown> = {};
    try { const p = JSON.parse(pitch.pitchContent || "{}"); if (p && typeof p === "object") content = p as Record<string, unknown>; } catch { /* empty proposal */ }

    const fields: Record<string, unknown> = {};
    for (const k of STRING_FIELDS) if (typeof content[k] === "string" && (content[k] as string).trim()) fields[k] = content[k];
    for (const k of LIST_FIELDS) if (Array.isArray(content[k]) && (content[k] as unknown[]).length) fields[k] = content[k];

    return {
      ok: true,
      data: {
        pitchId: pitch.id,
        business: pitch.businessName,
        type: pitch.documentType === "service_proposal" ? "proposal" : "pitch",
        fields,
        userMessage: `Read the "${pitch.businessName}" proposal's current content. Apply the user's change by rewriting the relevant fields with edit_pitch_field (pitchId="${pitch.id}") so it updates in place — don't paste it in chat.`,
      },
    };
  },
};
