import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * update_pitch — rewrite MANY parts of a proposal in ONE call (the whole
 * document or any subset) and save it so it updates live in Pitch Studio.
 *
 * edit_pitch_field only touches ONE flat field and can't reach the structured
 * sections (deliverables, timeline, proofPoints, customSections). When the user
 * asks to shorten / rewrite / restructure the WHOLE proposal, the agent must
 * rework EVERY populated section — this tool lets it do that in a single pass
 * instead of lazily editing one field. Pass a partial `content` patch; provided
 * keys replace the existing ones, untouched keys are preserved.
 * [[proposal-pdf-mirrors-studio]] [[agent-operates-account-full-crud]]
 */

const STRING_FIELDS = ["subject", "title", "subtitle", "serviceTitle", "executiveSummary", "aboutBrand", "clientNeed", "preparedFor", "preparedBy"];
const STRING_LIST_FIELDS = ["commitments", "benefits", "nextSteps", "terms"];

const str = (v: unknown, max = 4000): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const strList = (v: unknown, cap = 12): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 400)).filter(Boolean).slice(0, cap) : [];
const objList = <T>(v: unknown, map: (o: Record<string, unknown>) => T, cap = 12): T[] =>
  Array.isArray(v) ? v.filter((o): o is Record<string, unknown> => !!o && typeof o === "object").map(map).slice(0, cap) : [];

export const updatePitch: FlowAgentTool = {
  name: "update_pitch",
  description:
    "Rewrite MULTIPLE parts of a proposal at once (the whole document or any subset) and SAVE it — it updates live in Pitch Studio. Use THIS (not edit_pitch_field one field at a time) whenever the user asks to shorten, tighten, rewrite, restructure, or otherwise change the WHOLE proposal or several sections — rework EVERY populated section in one call, do not stop after one. Pass pitchId + a `content` object holding ONLY the keys you're changing; they replace the existing ones (lists are replaced wholesale — include the full rewritten array), everything else is preserved. Editable keys: subject, title, subtitle, serviceTitle, executiveSummary, aboutBrand, clientNeed (strings); commitments, benefits, nextSteps, terms (bullet lists); deliverables ([{title,description}]), timeline ([{label,title,description}]), proofPoints ([{metric,label,note}]), customSections ([{title,body,bullets:[]}]); pricing ({name,amount,originalAmount,interval,note}). NEVER paste the proposal in chat.",
  input_schema: {
    type: "object",
    properties: {
      pitchId: { type: "string", description: "The proposal's id (the surfaceContext gives you the OPEN one)." },
      content: {
        type: "object",
        description: "Partial proposal content — only the fields/sections you're rewriting. Merged over the existing proposal (lists replaced wholesale).",
      },
    },
    required: ["pitchId", "content"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    const patch = input.content && typeof input.content === "object" ? (input.content as Record<string, unknown>) : null;
    if (!pitchId || !patch) return { ok: false, error_code: "missing_input", message: "pitchId and a content object are required." };

    const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, userId: ctx.userId }, select: { id: true, pitchContent: true } });
    if (!pitch) return { ok: false, error_code: "not_found", message: "That proposal was not found." };

    let content: Record<string, unknown> = {};
    try { const p = JSON.parse(pitch.pitchContent || "{}"); if (p && typeof p === "object") content = p as Record<string, unknown>; } catch { /* start from the patch */ }

    const changed: string[] = [];
    for (const k of STRING_FIELDS) if (k in patch) { content[k] = str(patch[k]); changed.push(k); }
    for (const k of STRING_LIST_FIELDS) if (k in patch) { content[k] = strList(patch[k]); changed.push(k); }
    if ("deliverables" in patch) { content.deliverables = objList(patch.deliverables, (o) => ({ title: str(o.title, 200), description: str(o.description, 1200) })); changed.push("deliverables"); }
    if ("timeline" in patch) { content.timeline = objList(patch.timeline, (o) => ({ label: str(o.label, 80), title: str(o.title, 200), description: str(o.description, 1000) })); changed.push("timeline"); }
    if ("proofPoints" in patch) { content.proofPoints = objList(patch.proofPoints, (o) => ({ metric: str(o.metric, 40), label: str(o.label, 120), note: str(o.note, 300) })); changed.push("proofPoints"); }
    if ("customSections" in patch) {
      content.customSections = objList(patch.customSections, (o) => ({ title: str(o.title, 200), body: str(o.body, 1500), bullets: strList(o.bullets, 8) }), 8);
      changed.push("customSections");
    }
    if ("pricing" in patch && patch.pricing && typeof patch.pricing === "object") {
      const pr = patch.pricing as Record<string, unknown>;
      const existing = (content.pricing && typeof content.pricing === "object" ? content.pricing : {}) as Record<string, unknown>;
      content.pricing = {
        ...existing,
        ...(pr.name !== undefined ? { name: str(pr.name, 120) } : {}),
        ...(pr.amount !== undefined ? { amount: Number(pr.amount) } : {}),
        ...(pr.originalAmount !== undefined ? { originalAmount: Number(pr.originalAmount) } : {}),
        ...(pr.interval !== undefined ? { interval: str(pr.interval, 40) } : {}),
        ...(pr.note !== undefined ? { note: str(pr.note, 400) } : {}),
      };
      changed.push("pricing");
    }

    if (changed.length === 0) {
      return { ok: false, error_code: "missing_input", message: "No editable fields in `content`. Editable: subject, title, subtitle, serviceTitle, executiveSummary, aboutBrand, clientNeed, commitments, benefits, nextSteps, terms, deliverables, timeline, proofPoints, customSections, pricing." };
    }

    await prisma.pitch.update({ where: { id: pitchId }, data: { pitchContent: JSON.stringify(content) } });
    ctx.emit({ type: "canvas_update", patch: { __pitch: { pitchId, fields: changed } } });

    return {
      ok: true,
      data: { pitchId, updated: changed, userMessage: `Reworked ${changed.length} section${changed.length === 1 ? "" : "s"} of the proposal — it's refreshed in Pitch Studio. Don't repeat the content in chat.` },
      resultRefType: "Pitch",
      resultRefId: pitchId,
    };
  },
};
