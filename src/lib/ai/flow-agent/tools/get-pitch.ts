import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

// Editable content of a proposal. Flat fields + the STRUCTURED sections
// (deliverables, timeline, proofPoints, customSections) that make up most of the
// document — the agent needs ALL of these to rework the whole pitch, not just the
// flat ones. Mirrors update-pitch.ts's editable surface.
const STRING_FIELDS = ["title", "subtitle", "serviceTitle", "executiveSummary", "aboutBrand", "clientNeed", "preparedFor", "preparedBy", "subject"];
const LIST_FIELDS = ["commitments", "benefits", "nextSteps", "terms"];
const OBJECT_LIST_FIELDS = ["deliverables", "timeline", "proofPoints", "customSections"];

/**
 * get_pitch — READ one proposal's CURRENT editable content by pitchId, so the
 * agent can see EVERY section the OPEN proposal actually contains before
 * rewriting/shortening it (list_pitches only returns metadata; this returns the
 * full field + section text). The companion to update_pitch / edit_pitch_field.
 * Read-only, free. [[proposal-pdf-mirrors-studio]] [[agent-operates-account-full-crud]]
 */
export const getPitch: FlowAgentTool = {
  name: "get_pitch",
  description:
    "READ the CURRENT content of ONE proposal/pitch by pitchId — returns EVERY editable section with its present text: strings (title, subtitle, serviceTitle, executiveSummary, aboutBrand, clientNeed, preparedFor, preparedBy, subject), bullet lists (commitments, benefits, nextSteps, terms), and the STRUCTURED sections (deliverables, timeline, proofPoints, customSections, pricing). Call this FIRST whenever the user asks to shorten, tighten, rewrite, or restructure the OPEN proposal — you need to see EVERYTHING it currently says, then rewrite ALL the wordy sections in one update_pitch call. Read-only, free.",
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
    for (const k of OBJECT_LIST_FIELDS) if (Array.isArray(content[k]) && (content[k] as unknown[]).length) fields[k] = content[k];
    if (content.pricing && typeof content.pricing === "object") fields.pricing = content.pricing;

    return {
      ok: true,
      data: {
        pitchId: pitch.id,
        business: pitch.businessName,
        type: pitch.documentType === "service_proposal" ? "proposal" : "pitch",
        fields,
        userMessage: `Read the "${pitch.businessName}" proposal's full content (every section above). To apply the user's change, rewrite ALL the sections that need it in ONE update_pitch call (pitchId="${pitch.id}") so it updates in place — cover the whole document, don't stop after one section, and don't paste it in chat.`,
      },
    };
  },
};
