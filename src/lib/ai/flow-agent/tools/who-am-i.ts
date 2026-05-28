import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * who_am_i — fetch the user's identity slice: name, plan, credits,
 * timezone (when set), brand kit summary. Read-only, free. The agent
 * should call this when it needs to know who it's talking to — e.g.
 * before scheduling something time-anchored.
 */
export const whoAmI: FlowAgentTool = {
  name: "who_am_i",
  description:
    "Get the current user's identity: name, plan tier, remaining credits, and a brand-kit summary if configured. Free to call. Use this when you need to address the user by name, check their plan tier before suggesting a feature, or warn them about low credits.",
  input_schema: { type: "object", properties: {} },
  plans: null,
  costKey: "AGENT_WHO_AM_I",
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          plan: true,
          planExpiresAt: true,
          aiCredits: true,
          createdAt: true,
        },
      });
      if (!user) {
        return {
          ok: false,
          error_code: "not_found",
          message: "User record missing — the user may need to re-sign in.",
        };
      }
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: {
          name: true,
          industry: true,
          niche: true,
          targetAudience: true,
          voiceTone: true,
          uniqueValue: true,
        },
      });
      return {
        ok: true,
        data: {
          name: user.name,
          username: user.username,
          email: user.email,
          plan: user.plan,
          planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
          credits: user.aiCredits,
          memberSince: user.createdAt.toISOString().slice(0, 10),
          brand: brandKit
            ? {
                name: brandKit.name,
                industry: brandKit.industry,
                niche: brandKit.niche,
                targetAudience: brandKit.targetAudience,
                voiceTone: brandKit.voiceTone,
                uniqueValue: brandKit.uniqueValue,
              }
            : null,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to load user identity",
      };
    }
  },
};
