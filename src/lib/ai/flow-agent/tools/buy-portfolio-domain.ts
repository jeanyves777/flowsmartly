import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer, getDefaultPaymentMethod } from "@/lib/stripe";
import { createDomainPaymentIntent } from "@/lib/stripe/ecommerce";
import { searchDomains } from "@/lib/domains/manager";
import { getDomainRetailPrice } from "@/lib/domains/pricing";
import { nextSeqForConversation } from "../conversation-seq";
import type { FlowAgentTool } from "../registry";
import type { PlanStep } from "../tool-context";

/**
 * buy_portfolio_domain — buy a NEW custom domain and AUTO-ATTACH it to the
 * portfolio. Mirrors buy_credits: a Confirm card with the exact yearly price,
 * charges the user's saved card on Confirm, and the domain-purchase webhook
 * registers the domain + sets portfolio.customDomain (published) — DNS + SSL
 * are automatic. mutating:false because it runs its own confirm gate.
 */

const CARD_ADD_URL = "/home/credits";
const BRAND_URL = "/home/brand";

export const buyPortfolioDomain: FlowAgentTool = {
  name: "buy_portfolio_domain",
  description:
    "Buy a NEW custom domain and AUTO-ATTACH it to the user's portfolio — fully agent-driven. Pass { domain, tld } (from find_domain). Needs a saved card + complete Brand Identity (registrant contact). Shows a Confirm card with the exact yearly price, charges the saved card on Confirm, registers the domain and attaches it to the portfolio (published; DNS + SSL automatic — the user never touches DNS). For a domain the user already owns, use connect_portfolio_domain instead.",
  input_schema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "The SLD or full domain, e.g. 'jordanlee' or 'jordanlee.co'." },
      tld: { type: "string", description: "The TLD without the dot, e.g. 'co', 'com', 'me'." },
    },
    required: ["domain", "tld"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const tld = typeof input.tld === "string" ? input.tld.trim().replace(/^\./, "").toLowerCase() : "";
      let sld = typeof input.domain === "string" ? input.domain.trim().toLowerCase() : "";
      if (!sld || !tld) return { ok: false, error_code: "missing_input", message: "Provide the domain and tld (e.g. domain:'jordanlee', tld:'co')." };
      if (sld.endsWith(`.${tld}`)) sld = sld.slice(0, -(tld.length + 1));
      sld = sld.replace(/\..*$/, "");
      const fullDomain = `${sld}.${tld}`;

      const portfolio = await prisma.portfolio.findFirst({ where: { userId: ctx.userId, deletedAt: null }, select: { id: true } });
      if (!portfolio) return { ok: false, error_code: "validation_failed", message: "No portfolio to attach a domain to — build one first with build_portfolio." };

      const price = getDomainRetailPrice(tld);
      if (price === null) return { ok: false, error_code: "validation_failed", message: `The .${tld} TLD isn't supported. Use find_domain to see available options.` };

      // Availability check (best-effort).
      const results = await searchDomains(sld, [tld]).catch(() => []);
      const match = results.find((r) => r.tld === tld);
      if (match && !match.available) return { ok: false, error_code: "validation_failed", message: `${fullDomain} is taken. Use find_domain to find an available one.` };

      // Registrant contact must be complete in the Brand Kit.
      const bk = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, country: true },
      });
      const missing: string[] = [];
      if (!bk?.name) missing.push("business name");
      if (!bk?.email) missing.push("email");
      if (!bk?.phone) missing.push("phone");
      if (!bk?.address) missing.push("address");
      if (!bk?.city) missing.push("city");
      if (!bk?.state) missing.push("state");
      if (!bk?.zip) missing.push("zip");
      if (!bk?.country) missing.push("country");
      if (missing.length) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Domain registration needs complete contact info in the Brand Kit. Missing: ${missing.join(", ")}. Ask the user to complete it at ${BRAND_URL}, then retry.`,
          meta: { brandUrl: BRAND_URL, missing },
        };
      }

      // Saved card.
      const customerId = await getOrCreateStripeCustomer(ctx.userId);
      const card = await getDefaultPaymentMethod(customerId);
      if (!card) {
        return { ok: false, error_code: "no_payment_method", message: `No saved card — tell the user to add one at ${CARD_ADD_URL}, then retry buying the domain.`, meta: { addCardUrl: CARD_ADD_URL } };
      }

      const priceUsd = (price / 100).toFixed(2);
      const summary = `Buy ${fullDomain} for $${priceUsd}/yr — charged to ${card.brand} •••• ${card.last4}, then attached to your portfolio`;
      const steps: PlanStep[] = [{ id: "s1", title: `Register ${fullDomain} — $${priceUsd}/yr`, detail: `Charged to your saved ${card.brand} ending ${card.last4}; auto-attached + published` }];
      const planId = `plan_${randomUUID().slice(0, 12)}`;
      try {
        const seq = await nextSeqForConversation(ctx.conversationId);
        await prisma.agentPlanProposal.create({
          data: { id: planId, conversationId: ctx.conversationId, messageId: ctx.messageId, userId: ctx.userId, summary, steps: JSON.stringify(steps), totalCreditCost: 0, status: "pending", expiresAt: new Date(Date.now() + 10 * 60 * 1000), seq },
        });
      } catch { /* non-fatal — awaitConfirmation still gates the charge */ }
      ctx.emit({ type: "plan_proposal", id: planId, steps, summary, totalCreditCost: 0 });
      const confirmed = await ctx.awaitConfirmation(planId);
      try {
        const cur = await prisma.agentPlanProposal.findUnique({ where: { id: planId }, select: { status: true } });
        if (!cur || cur.status === "pending") await prisma.agentPlanProposal.update({ where: { id: planId }, data: { status: confirmed ? "confirmed" : "expired", resolvedAt: new Date() } });
      } catch { /* ignore */ }
      if (!confirmed) return { ok: false, error_code: "user_canceled", message: "The user didn't confirm the domain purchase. Don't charge anything.", recoverable: true };

      // Charge + create the domain PaymentIntent. The domain-purchase webhook
      // registers the domain and attaches it to the portfolio (portfolioId meta).
      let pi: { status: string; paymentIntentId: string; requiresAction: boolean };
      try {
        pi = await createDomainPaymentIntent({ userId: ctx.userId, customerId, domainName: fullDomain, amountCents: price, storeId: "", tld, paymentMethodId: card.id, portfolioId: portfolio.id });
      } catch (e) {
        const err = e as { code?: string; raw?: { code?: string }; message?: string };
        const code = err?.code || err?.raw?.code;
        if (code === "authentication_required") {
          return { ok: false, error_code: "upstream_failed", message: "That card needs extra verification for this charge — tell the user to buy the domain from the Domains surface (it handles the security check), then it'll attach automatically.", recoverable: true };
        }
        return { ok: false, error_code: "upstream_failed", message: `The card was declined or the charge failed (${err?.message || "payment error"}). Suggest a different card at ${CARD_ADD_URL}.`, recoverable: true };
      }

      if (pi.status !== "succeeded" && pi.status !== "processing") {
        return { ok: false, error_code: "upstream_failed", message: pi.requiresAction ? "The card needs extra verification — the user should complete it at the Domains surface, then it registers automatically." : `Payment didn't complete (status: ${pi.status}).`, recoverable: true };
      }

      return {
        ok: true,
        data: {
          domain: fullDomain,
          priceUsd,
          status: "registering",
          url: `https://${fullDomain}`,
          hint: `Paid $${priceUsd} and registering ${fullDomain}. It auto-attaches to the portfolio and goes live (DNS + SSL) in ~2-15 minutes — the user doesn't touch DNS. Tell them it's on its way.`,
        },
        resultRefType: "Portfolio",
        resultRefId: portfolio.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to buy the domain." };
    }
  },
};
