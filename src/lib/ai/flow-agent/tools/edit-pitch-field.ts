import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * edit_pitch_field — rewrite ONE field/section of a proposal in Pitch Studio and
 * deliver it INTO the document (never a chat dump). The "Edit with AI" chip on a
 * block hands the agent that field + the user's instruction; the agent composes
 * the new copy and calls this to write it back onto the pitch, so it updates live
 * on the page. [[agent-writes-into-ui-element-not-chat]]
 */

const STRING_FIELDS = new Set(["title", "subtitle", "serviceTitle", "executiveSummary", "aboutBrand", "clientNeed", "preparedFor", "preparedBy", "subject"]);
const LIST_FIELDS = new Set(["commitments", "benefits", "nextSteps", "terms"]);

export const editPitchField: FlowAgentTool = {
  name: "edit_pitch_field",
  description:
    "Rewrite ONE field/section of a proposal in Pitch Studio and save it onto the pitch so it updates live in the document — NEVER paste the new copy in the chat. Use when the user clicks 'Edit with AI' on a block or asks to change a specific part. Pass the pitchId, the `field` name, and the new `value` you composed (in the user's brand voice). String fields: title, subtitle, serviceTitle, executiveSummary, aboutBrand, clientNeed, preparedFor, preparedBy, subject. List fields (bullets, one per line in `value`): commitments, benefits, nextSteps, terms.",
  input_schema: {
    type: "object",
    properties: {
      pitchId: { type: "string", description: "The Pitch id shown in the Pitch Studio context." },
      field: { type: "string", description: "The field to rewrite (see the description for the allowed names)." },
      value: { type: "string", description: "The new copy. For list fields, put one bullet per line." },
    },
    required: ["pitchId", "field", "value"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    const field = typeof input.field === "string" ? input.field.trim() : "";
    const value = typeof input.value === "string" ? input.value : "";
    if (!pitchId || !field) return { ok: false, error_code: "missing_input", message: "pitchId and field are required." };
    if (!STRING_FIELDS.has(field) && !LIST_FIELDS.has(field)) return { ok: false, error_code: "missing_input", message: `Unknown field "${field}". Allowed: ${[...STRING_FIELDS, ...LIST_FIELDS].join(", ")}.` };

    const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, userId: ctx.userId }, select: { id: true, pitchContent: true } });
    if (!pitch) return { ok: false, error_code: "not_found", message: "That proposal was not found." };

    let content: Record<string, unknown> = {};
    try { const p = JSON.parse(pitch.pitchContent || "{}"); if (p && typeof p === "object") content = p as Record<string, unknown>; } catch { /* start fresh */ }

    if (LIST_FIELDS.has(field)) {
      content[field] = value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12);
    } else {
      content[field] = value.slice(0, 4000);
    }

    await prisma.pitch.update({ where: { id: pitchId }, data: { pitchContent: JSON.stringify(content) } });
    ctx.emit({ type: "canvas_update", patch: { __pitch: { pitchId, field } } });

    return {
      ok: true,
      data: { pitchId, field, userMessage: `Updated the ${field} in the proposal — it's refreshed on the page. Don't repeat it in chat.` },
      resultRefType: "Pitch",
      resultRefId: pitchId,
    };
  },
};
