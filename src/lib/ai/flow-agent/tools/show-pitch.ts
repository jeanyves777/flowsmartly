import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";
import { proposalPitchView } from "@/lib/agent-views/templates";

/**
 * show_pitch - render a proposal/pitch as an editable inline chat card.
 * Supports both service_proposal content and legacy cold-pitch content.
 */
export const showPitch: FlowAgentTool = {
  name: "show_pitch",
  description:
    "Render a proposal/pitch as an EDITABLE card inline in the chat: subject, summary and key sections with Rewrite / Shorten / More formal buttons + a tweak input, and Send / Open Pitch Studio. Use it right AFTER create_pitch/create_proposal, or when the user wants to see/edit a pitch. When an edit action comes back, call get_pitch then update_pitch/edit_pitch_field. To send it, use send_proposal. Pass pitchId.",
  input_schema: {
    type: "object",
    properties: { pitchId: { type: "string", description: "The pitch/proposal id." } },
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
      select: { id: true, businessName: true, pitchContent: true },
    });
    if (!pitch) return { ok: false, error_code: "not_found", message: `No pitch "${pitchId}". Use list_pitches to find it.` };

    let c: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(pitch.pitchContent || "{}");
      if (parsed && typeof parsed === "object") c = parsed as Record<string, unknown>;
    } catch {
      /* empty */
    }

    const str = (k: string) => (typeof c[k] === "string" && (c[k] as string).trim() ? (c[k] as string).trim() : undefined);
    const list = (k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is string => typeof x === "string") : []);
    const objList = (k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

    const sections: { label: string; text: string }[] = [];
    const addSection = (label: string, text?: string) => { if (text) sections.push({ label, text }); };
    const joinList = (items: string[]) => items.slice(0, 6).join(" | ");

    addSection("The need", str("clientNeed"));
    addSection("What we deliver", str("serviceTitle"));
    addSection("Personalized hook", str("personalizedHook"));
    addSection("Opportunity", str("opportunityParagraph"));
    addSection("Impact", str("impactParagraph"));

    const benefits = list("benefits"); if (benefits.length) addSection("Benefits", joinList(benefits));
    const nextSteps = list("nextSteps"); if (nextSteps.length) addSection("Next steps", joinList(nextSteps));
    const findings = list("keyFindings"); if (findings.length) addSection("Key findings", joinList(findings));
    const solution = list("solutionBullets"); if (solution.length) addSection("Solution", joinList(solution));

    const visualImages = (c.visualAssets && typeof c.visualAssets === "object" && Array.isArray((c.visualAssets as { images?: unknown }).images))
      ? ((c.visualAssets as { images: unknown[] }).images.filter((x): x is Record<string, unknown> => !!x && typeof x === "object"))
      : [];
    const coverImage = visualImages.find((im) => im.kind === "cover" && typeof im.url === "string")?.url as string | undefined;
    const metrics = objList("proofPoints").map((p) => ({ label: String(p.label ?? ""), value: String(p.metric ?? "") })).filter((p) => p.label || p.value);
    const deliverables = objList("deliverables")
      .map((d) => ({ title: String(d.title ?? ""), description: String(d.description ?? "") }))
      .filter((d) => d.title || d.description)
      .concat(solution.slice(0, 4).map((s) => ({ title: s.split(":")[0]?.trim() || "Recommended action", description: s })));
    const timeline = objList("timeline").map((t) => ({ label: String(t.label ?? ""), title: String(t.title ?? "") })).filter((t) => t.label || t.title);
    const variant = c.studioDocType === "visual" ? "visual" : "deck";

    ctx.emit({
      type: "agent_view",
      requestId: `pitch-${pitch.id}`,
      spec: proposalPitchView({
        id: pitch.id,
        business: pitch.businessName,
        title: str("title") || str("headline") || `Pitch for ${pitch.businessName}`,
        subject: str("subject"),
        summary: str("executiveSummary") || str("personalizedHook"),
        variant,
        coverImage,
        metrics,
        deliverables,
        timeline,
        sections,
      }),
    });

    return {
      ok: true,
      data: {
        pitchId: pitch.id,
        userMessage: `Rendered the "${pitch.businessName}" pitch as an editable inline card. STOP and wait for the user's edit/send action. Do not paste the pitch as text.`,
      },
    };
  },
};
