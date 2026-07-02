import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateOneProposalVisual } from "@/lib/pitch/proposal-visuals";
import type { ProposalVisualAsset, ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import type { FlowAgentTool } from "../registry";

/**
 * regenerate_proposal_visual — generate a fresh on-brand image for ONE slot of a
 * Visual-deck proposal (cover / about / impact) and attach it so it updates live
 * in Pitch Studio — NEVER a chat dump. Fires when the user clicks "Generate /
 * Regenerate with AI" on an image tile. The image fits the business type + the
 * user's Brand Kit colours. Runs inline so it snaps into place by the end of the
 * turn. [[agent-writes-into-ui-element-not-chat]]
 */

const SLOTS = new Set<ProposalVisualAsset["kind"]>(["cover", "about", "impact"]);

export const regenerateProposalVisual: FlowAgentTool = {
  name: "regenerate_proposal_visual",
  description:
    "Generate a fresh, on-brand IMAGE for ONE slot of a Visual-deck proposal and attach it so it updates live in Pitch Studio (never paste it in chat). Use when the user clicks 'Generate/Regenerate with AI' on the cover, about, or impact image, or asks to change a proposal's visual. Pass the pitchId, the `slot` ('cover' | 'about' | 'impact'), and optionally a `prompt` with creative direction (subject/mood) — leave it empty for an on-brand default drawn from the section + the user's Brand Kit. Do NOT ask for any text or logo inside the image. Charges the standard image-generation cost.",
  input_schema: {
    type: "object",
    properties: {
      pitchId: { type: "string", description: "The Pitch id shown in the Pitch Studio context." },
      slot: { type: "string", description: "Which image to (re)generate: 'cover', 'about', or 'impact'." },
      prompt: { type: "string", description: "Optional creative direction (subject, mood, composition). Leave empty to use an on-brand default for the section + business type. Never request text, words, or logos in the image." },
    },
    required: ["pitchId", "slot"],
  },
  plans: null,
  // Base 0 — the handler charges the standard image cost AFTER a successful render
  // so a provider failure never drains the balance.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    const slot = (typeof input.slot === "string" ? input.slot.trim().toLowerCase() : "") as ProposalVisualAsset["kind"];
    const promptOverride = typeof input.prompt === "string" ? input.prompt : "";
    if (!pitchId || !SLOTS.has(slot)) {
      return { ok: false, error_code: "missing_input", message: "pitchId and a valid slot ('cover' | 'about' | 'impact') are required." };
    }

    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, userId: ctx.userId },
      select: { id: true, businessName: true, pitchContent: true },
    });
    if (!pitch) return { ok: false, error_code: "not_found", message: "That proposal was not found." };

    let content: ServiceProposalContent;
    try {
      const parsed = JSON.parse(pitch.pitchContent || "{}");
      if (!parsed || typeof parsed !== "object") throw new Error("bad content");
      content = parsed as ServiceProposalContent;
    } catch {
      return { ok: false, error_code: "internal", message: "The proposal content could not be read." };
    }

    // Pre-flight credit check (standard image tier).
    const cost = await getDynamicCreditCost("AGENT_GENERATE_IMAGE_STANDARD");
    if (!ctx.isAdmin && cost > 0) {
      const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
      if ((user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `A proposal image costs ${cost} credits. User has ${user?.aiCredits ?? 0}. Suggest /home/billing to top up.`,
          meta: { need: cost, have: user?.aiCredits ?? 0 },
        };
      }
    }

    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: ctx.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { name: true, tagline: true, description: true, industry: true, niche: true, targetAudience: true, voiceTone: true, uniqueValue: true, colors: true, fonts: true },
    });

    const asset = await generateOneProposalVisual({
      userId: ctx.userId,
      targetName: content.preparedFor || pitch.businessName || "the client",
      serviceTitle: content.serviceTitle || content.title || "our services",
      proposal: content,
      brandKit,
      kind: slot,
      promptOverride,
    });
    if (!asset) {
      return { ok: false, error_code: "internal", message: "Image generation failed. Tell the user and offer to try again." };
    }

    const prev = Array.isArray(content.visualAssets?.images) ? content.visualAssets!.images : [];
    const images = [...prev.filter((im) => im.kind !== slot), asset];
    const next: ServiceProposalContent = { ...content, visualAssets: { generatedAt: new Date().toISOString(), images } };
    await prisma.pitch.update({ where: { id: pitchId }, data: { pitchContent: JSON.stringify(next) } });

    // Charge AFTER success.
    if (!ctx.isAdmin && cost > 0) {
      await creditService.deductCredits({
        userId: ctx.userId,
        amount: cost,
        type: "USAGE",
        description: `Flow-AI proposal ${slot} image`,
        referenceType: "flow_ai_tool",
        referenceId: pitchId,
      });
    }

    // Nudge the studio to reload so the new image snaps into place.
    ctx.emit({ type: "canvas_update", patch: { __pitch: { pitchId, image: slot } } });

    return {
      ok: true,
      data: { pitchId, slot, url: asset.url, userMessage: `Generated a fresh on-brand ${slot} image — it's live on the proposal in Pitch Studio. Don't repeat it in chat.` },
      resultRefType: "Pitch",
      resultRefId: pitchId,
    };
  },
};
