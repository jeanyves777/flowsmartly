import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";
import { proposalPitchView } from "@/lib/agent-views/templates";

/**
 * show_pitch — render a proposal/pitch as an EDITABLE card inline in the chat:
 * subject, summary + key sections with Rewrite / Shorten / More formal buttons,
 * a tweak input, and Send / Open Pitch Studio. The user reworks the pitch in the
 * conversation (each edit comes back to you → get_pitch + update_pitch), then
 * sends it — without leaving the chat. [[agent-authored-views]]
 */
export const showPitch: FlowAgentTool = {
  name: "show_pitch",
  description:
    "Render a proposal/pitch as an EDITABLE card inline in the chat — subject, summary and key sections with ✨ Rewrite / ✂ Shorten / 🎩 More formal buttons + a tweak input, and ✉ Send / Open Pitch Studio. Use it right AFTER create_pitch (so the user reviews + edits it in the conversation), or when the user wants to see/edit a pitch. When an edit action/instruction comes back, call get_pitch then update_pitch (or edit_pitch_field) on that pitchId so it updates in place; to send it, use send_proposal. Pass pitchId.",
  input_schema: {
    type: "object",
    properties: { pitchId: { type: "string", description: "The pitch/proposal id (from create_pitch or list_pitches)." } },
    required: ["pitchId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    if (!pitchId) return { ok: false, error_code: "missing_input", message: "pitchId is required." };
    const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, userId: ctx.userId }, select: { id: true, businessName: true, pitchContent: true } });
    if (!pitch) return { ok: false, error_code: "not_found", message: `No pitch "${pitchId}". Use list_pitches to find it.` };

    let c: Record<string, unknown> = {};
    try { const p = JSON.parse(pitch.pitchContent || "{}"); if (p && typeof p === "object") c = p as Record<string, unknown>; } catch { /* empty */ }
    const str = (k: string) => (typeof c[k] === "string" && (c[k] as string).trim() ? (c[k] as string).trim() : undefined);
    const list = (k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is string => typeof x === "string") : []);
    const objList = (k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

    const sections: { label: string; text: string }[] = [];
    const need = str("clientNeed"); if (need) sections.push({ label: "The need", text: need });
    const svc = str("serviceTitle"); if (svc) sections.push({ label: "What we deliver", text: svc });
    const benefits = list("benefits"); if (benefits.length) sections.push({ label: "Benefits", text: benefits.slice(0, 5).join(" • ") });
    const nextSteps = list("nextSteps"); if (nextSteps.length) sections.push({ label: "Next steps", text: nextSteps.slice(0, 4).join(" • ") });

    const visualImages = (c.visualAssets && typeof c.visualAssets === "object" && Array.isArray((c.visualAssets as { images?: unknown }).images))
      ? ((c.visualAssets as { images: unknown[] }).images.filter((x): x is Record<string, unknown> => !!x && typeof x === "object"))
      : [];
    const coverImage = visualImages.find((im) => im.kind === "cover" && typeof im.url === "string")?.url as string | undefined;
    const metrics = objList("proofPoints").map((p) => ({ label: String(p.label ?? ""), value: String(p.metric ?? "") })).filter((p) => p.label || p.value);
    const deliverables = objList("deliverables").map((d) => ({ title: String(d.title ?? ""), description: String(d.description ?? "") })).filter((d) => d.title || d.description);
    const timeline = objList("timeline").map((t) => ({ label: String(t.label ?? ""), title: String(t.title ?? "") })).filter((t) => t.label || t.title);
    const variant = c.studioDocType === "visual" ? "visual" : "deck";

    ctx.emit({
      type: "agent_view",
      requestId: `pitch-${pitch.id}`,
      spec: proposalPitchView({ id: pitch.id, business: pitch.businessName, title: str("title"), subject: str("subject"), summary: str("executiveSummary"), variant, coverImage, metrics, deliverables, timeline, sections }),
    });

    return {
      ok: true,
      data: {
        pitchId: pitch.id,
        userMessage: `Rendered the "${pitch.businessName}" pitch as an editable card in the chat (Rewrite / Shorten / More formal + a tweak input + Send). STOP and wait — when the user edits, call get_pitch then update_pitch on pitchId "${pitch.id}" so it updates in place; to send it, use send_proposal. Do NOT paste the pitch as text.`,
      },
    };
  },
};
