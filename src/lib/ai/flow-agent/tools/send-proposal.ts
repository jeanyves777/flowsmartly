import { channelConnected } from "@/lib/crm/sequence";
import { deliverProposal, type DeliverProposalCode } from "@/lib/pitch/send-proposal";
import type { ToolErrorCode } from "../tool-context";
import type { FlowAgentTool } from "../registry";

const CODE_MAP: Record<DeliverProposalCode, ToolErrorCode> = {
  not_found: "not_found",
  not_ready: "validation_failed",
  no_recipient: "missing_input",
  pdf_failed: "upstream_failed",
  error: "internal",
};

/**
 * send_proposal — email a branded proposal/pitch to a recipient with the PDF
 * attached (the SAME branded PDF the Pitch Studio shows), and mark it Sent. The
 * agent can do the whole send end-to-end; results land in the Pitch board UI.
 * Gated on the user's email being connected + verified — if it isn't, the tool
 * refuses and tells the agent to have the user connect email first. Mutating
 * (outbound email) → needs a confirmed propose_plan. [[agent-operates-account-full-crud]]
 */
export const sendProposal: FlowAgentTool = {
  name: "send_proposal",
  description:
    "Email a branded proposal/pitch to a recipient with the PDF attached and mark it Sent. Use when the user asks you to send/deliver a proposal. Pass the pitchId (from Pitch Studio / the Pitch board) and the recipientEmail; optional recipientName + a short personal message. REQUIRES the user's email to be connected + verified — if it isn't, this returns email_not_connected and you must tell the user to connect email in Settings → Connections first (never send from an unverified account). Mutating: pass planId from a confirmed propose_plan (that IS the send confirmation).",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan (the user's send confirmation)." },
      pitchId: { type: "string", description: "The proposal/pitch id to send." },
      recipientEmail: { type: "string", description: "The email address to send it to. Required." },
      recipientName: { type: "string", description: "Optional recipient name." },
      message: { type: "string", description: "Optional short personal note shown at the top of the email." },
      variant: { type: "string", description: "Optional PDF layout to attach: 'deck' or 'visual'. If omitted, uses the proposal's saved Studio type." },
    },
    required: ["planId", "pitchId", "recipientEmail"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const pitchId = typeof input.pitchId === "string" ? input.pitchId.trim() : "";
    const recipientEmail = typeof input.recipientEmail === "string" ? input.recipientEmail.trim() : "";
    const recipientName = typeof input.recipientName === "string" ? input.recipientName.trim() : undefined;
    const message = typeof input.message === "string" ? input.message.trim() : undefined;
    const variant = input.variant === "visual" ? "visual" : input.variant === "deck" ? "deck" : undefined;
    if (!pitchId || !recipientEmail) {
      return { ok: false, error_code: "missing_input", message: "pitchId and recipientEmail are required." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return { ok: false, error_code: "missing_input", message: `"${recipientEmail}" is not a valid email address.` };
    }

    // Gate: the user's email must be connected + verified.
    const emailOk = await channelConnected(ctx.userId, "email");
    if (!emailOk) {
      return {
        ok: false,
        error_code: "validation_failed",
        message: "The user's email isn't connected/verified yet. Tell them to connect + verify their email in Settings → Connections before you can send. Don't send from an unverified account.",
      };
    }

    const res = await deliverProposal(ctx.userId, pitchId, { recipientEmail, recipientName, message, variant });
    if (!res.ok) {
      return { ok: false, error_code: CODE_MAP[res.code || "error"], message: res.error || "Could not send the proposal." };
    }

    // Nudge the Pitch board to refresh (status → Sent).
    ctx.emit({ type: "canvas_update", patch: { __pitch: { pitchId, sent: true } } });

    return {
      ok: true,
      data: { pitchId, sentTo: res.sentTo, userMessage: `Sent the proposal to ${res.sentTo}. It's marked Sent in the Pitch board.` },
      resultRefType: "Pitch",
      resultRefId: pitchId,
    };
  },
};
