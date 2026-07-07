import { prisma } from "@/lib/db/client";
import { connectExistingDomain } from "@/lib/domains/manager";
import type { FlowAgentTool } from "../registry";

/**
 * connect_portfolio_domain — attach a domain the user ALREADY OWNS (BYOD) to
 * their portfolio. Sets up the Cloudflare zone + DNS, links it, publishes the
 * portfolio, and returns the nameservers the user must set at their registrar.
 */
export const connectPortfolioDomain: FlowAgentTool = {
  name: "connect_portfolio_domain",
  description:
    "Attach a custom domain the user ALREADY OWNS to their portfolio (bring-your-own-domain). Sets it up (Cloudflare zone + DNS + SSL), links it to the portfolio, and publishes it — then returns the NAMESERVERS the user must set at their current registrar to point the domain here. For buying a NEW domain, use buy_portfolio_domain instead.",
  input_schema: {
    type: "object",
    properties: { domain: { type: "string", description: "The full domain the user owns, e.g. 'jordanlee.co'." } },
    required: ["domain"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_PORTFOLIO",
  mutating: true,
  autoPlanCost: async () => ({ credits: 0, label: "Connect your domain", detail: "Links a domain you already own to your portfolio (free)." }),
  handler: async (input, ctx) => {
    try {
      const domain = typeof input.domain === "string"
        ? input.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : "";
      if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        return { ok: false, error_code: "missing_input", message: "Give the full domain the user owns, e.g. jordanlee.co." };
      }

      const portfolio = await prisma.portfolio.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true, publishedAt: true },
      });
      if (!portfolio) {
        return { ok: false, error_code: "validation_failed", message: "No portfolio to attach a domain to — build one first with build_portfolio." };
      }

      // Already set up (by this user) or connect fresh.
      let nameservers: string[] = [];
      const existing = await prisma.storeDomain.findUnique({ where: { domainName: domain }, select: { userId: true, nameservers: true } });
      if (existing) {
        if (existing.userId !== ctx.userId) {
          return { ok: false, error_code: "permission_denied", message: `${domain} is already connected to another account.` };
        }
        try { nameservers = JSON.parse(existing.nameservers || "[]"); } catch { nameservers = []; }
      } else {
        const res = await connectExistingDomain({ storeId: null, userId: ctx.userId, domain });
        nameservers = res.nameservers || [];
      }

      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { customDomain: domain, status: "PUBLISHED", ...(portfolio.publishedAt ? {} : { publishedAt: new Date() }) },
      });

      return {
        ok: true,
        data: {
          domain,
          nameservers,
          url: `https://${domain}`,
          hint: nameservers.length
            ? `Linked ${domain} to the portfolio and published it. Tell the user to set these nameservers at their registrar to go live: ${nameservers.join(", ")}. SSL provisions automatically once DNS points here (minutes to a few hours).`
            : `Linked ${domain} to the portfolio and published it.`,
        },
        resultRefType: "Portfolio",
        resultRefId: portfolio.id,
      };
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: e instanceof Error ? e.message : "Failed to connect the domain." };
    }
  },
};
