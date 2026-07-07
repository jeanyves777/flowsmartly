import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * list_pitches — READ the user's pitches & proposals so the agent can reference /
 * resend / edit an existing one (create_pitch, create_proposal, edit_pitch_field,
 * send_proposal all need an id it otherwise can't discover). Read-only.
 * [[proposal-pdf-mirrors-studio]] [[agent-operates-account-full-crud]]
 */
export const listPitches: FlowAgentTool = {
  name: "list_pitches",
  description:
    "READ the user's PITCHES & PROPOSALS (Pitch Studio). Use before create_pitch/create_proposal/send_proposal so you can point to an existing one instead of duplicating or asking the user. Filters: documentType ('pitch' = cold-outreach email | 'service_proposal' = branded deck), status. Returns each item's id, business/recipient, documentType, status (draft/ready/sent/failed), and sentAt. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      documentType: { type: "string", enum: ["pitch", "service_proposal"], description: "Optional — 'pitch' (cold email) or 'service_proposal' (branded deck)." },
      status: { type: "string", description: "Optional status filter." },
      limit: { type: "number", description: "Max rows (1-100, default 30)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 30;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (input.documentType === "pitch" || input.documentType === "service_proposal") where.documentType = input.documentType;
      if (typeof input.status === "string" && input.status.trim() && input.status !== "all") where.status = input.status.trim();
      const [rows, total] = await Promise.all([
        prisma.pitch.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true, businessName: true, businessUrl: true, documentType: true, status: true,
            recipientEmail: true, recipientName: true, sentAt: true, createdAt: true,
          },
        }),
        prisma.pitch.count({ where }),
      ]);
      return {
        ok: true,
        data: {
          count: total,
          returned: rows.length,
          pitches: rows.map((p) => ({
            id: p.id,
            business: p.businessName,
            url: p.businessUrl,
            type: p.documentType === "service_proposal" ? "proposal" : "pitch",
            status: p.status,
            recipient: p.recipientName || p.recipientEmail || null,
            sentAt: p.sentAt?.toISOString() ?? null,
            createdAt: p.createdAt.toISOString(),
          })),
          userMessage: total === 0 ? "No pitches or proposals yet." : `${total} pitch${total === 1 ? "" : "es"}/proposal${total === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list pitches" };
    }
  },
};
