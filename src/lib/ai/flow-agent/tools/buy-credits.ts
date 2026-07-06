import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import {
  getOrCreateStripeCustomer,
  getDefaultPaymentMethod,
  createCreditPaymentIntent,
  createCustomCreditPaymentIntent,
} from "@/lib/stripe";
import { nextSeqForConversation } from "../conversation-seq";
import type { FlowAgentTool } from "../registry";
import type { PlanStep } from "../tool-context";

/**
 * buy_credits — top up the user's credit balance INLINE in the chat.
 *
 * Flow (all in one place so a cheap model can't get it wrong):
 *  1. Called with no args → returns the available packs + balance + whether a
 *     card is saved; the agent presents the packs with ask_choice.
 *  2. Called with a packageId (or a custom `credits`/`amountUsd`) →
 *     - no saved card → returns { no_payment_method, addCardUrl } so the agent
 *       points them to /home/credits to add one, then retries;
 *     - saved card → shows a Confirm card (exact $ + card), and on Confirm
 *       charges that card and adds the credits, so the user keeps working.
 *
 * mutating:false because it does its OWN confirm gate (ctx.awaitConfirmation) —
 * money is only charged after the user taps Confirm. [[credit-based-not-plan-based]]
 */

// Per-credit price for a CUSTOM top-up. Packs are cheaper (bonus credits) — this
// is the plain rate for "give me exactly N credits / $X".
const CUSTOM_CENTS_PER_CREDIT = 3;
const CUSTOM_MIN_CENTS = 100;   // $1
const CUSTOM_MAX_CENTS = 50000; // $500

const CARD_ADD_URL = "/home/credits"; // new-design surface: add a card + buy inline

export const buyCredits: FlowAgentTool = {
  name: "buy_credits",
  description:
    "Top up the user's credits INLINE in the chat — use this whenever they're out of credits or ask to buy/top up. Call it with NO arguments first to get the available credit packs (present them to the user with `ask_choice` — one option per pack: label = the credits (+bonus), sublabel = the $ price — plus a 'Custom amount' option). Then call it again with the chosen `packageId`, OR a custom `credits` number, OR a custom `amountUsd`. If the user has a saved card, this shows a Confirm card with the exact price + card and, on Confirm, charges it and adds the credits — then continue the task they wanted. If they have NO saved card, it returns an addCardUrl — tell them to add a card there, then retry. Never fabricate prices; use the pack data this tool returns.",
  input_schema: {
    type: "object",
    properties: {
      packageId: { type: "string", description: "The pack the user chose, e.g. 'credits_500' (from this tool's returned packages)." },
      credits: { type: "number", description: "Custom credit amount to buy (used only when no packageId). Priced at the standard per-credit rate." },
      amountUsd: { type: "number", description: "Custom dollar amount to spend (used only when no packageId). Converted to credits at the standard rate." },
    },
    required: [],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const packageId = typeof input.packageId === "string" && input.packageId.trim() ? input.packageId.trim() : null;
      const customCredits = typeof input.credits === "number" && input.credits > 0 ? Math.round(input.credits) : null;
      const customAmountUsd = typeof input.amountUsd === "number" && input.amountUsd > 0 ? input.amountUsd : null;

      // ── Step 1: no selection yet → return the packs for the agent to present ──
      if (!packageId && !customCredits && !customAmountUsd) {
        const [packs, user] = await Promise.all([
          prisma.creditPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
          prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true, stripeCustomerId: true } }),
        ]);
        const customerId = user?.stripeCustomerId ?? null;
        const hasCard = customerId ? !!(await getDefaultPaymentMethod(customerId)) : false;
        return {
          ok: true,
          data: {
            balance: user?.aiCredits ?? 0,
            hasSavedCard: hasCard,
            packages: packs.map((p) => ({
              packageId: p.packageId,
              credits: p.credits,
              bonus: p.bonusCredits,
              total: p.credits + p.bonusCredits,
              priceUsd: (p.priceCents / 100).toFixed(2),
            })),
            customRate: { centsPerCredit: CUSTOM_CENTS_PER_CREDIT, minUsd: CUSTOM_MIN_CENTS / 100, maxUsd: CUSTOM_MAX_CENTS / 100 },
            guidance:
              "Present these packs with ask_choice (one option per pack: label = the credits + any bonus, sublabel = the $ price), plus a 'Custom amount' option. When the user picks, call buy_credits again with the packageId (or a custom `credits`/`amountUsd`). Don't paste a big text list — use the clickable card.",
          },
        };
      }

      // ── Resolve what they're buying ──
      let credits: number;
      let bonus = 0;
      let priceCents: number;
      let resolvedPackageId: string | null = packageId;

      if (packageId) {
        const pkg = await prisma.creditPackage.findUnique({ where: { packageId } });
        if (!pkg || !pkg.isActive) {
          return { ok: false, error_code: "not_found", message: `That pack ("${packageId}") isn't available. Call buy_credits with no args to get the current packs.` };
        }
        credits = pkg.credits;
        bonus = pkg.bonusCredits;
        priceCents = pkg.priceCents;
      } else {
        // Custom amount (by credits or by dollars).
        if (customAmountUsd) {
          priceCents = Math.round(customAmountUsd * 100);
          credits = Math.floor(priceCents / CUSTOM_CENTS_PER_CREDIT);
        } else {
          credits = customCredits!;
          priceCents = credits * CUSTOM_CENTS_PER_CREDIT;
        }
        if (priceCents < CUSTOM_MIN_CENTS) return { ok: false, error_code: "validation_failed", message: `The minimum top-up is $${(CUSTOM_MIN_CENTS / 100).toFixed(2)}.` };
        if (priceCents > CUSTOM_MAX_CENTS) return { ok: false, error_code: "validation_failed", message: `The max custom top-up is $${(CUSTOM_MAX_CENTS / 100).toFixed(0)} — pick a pack or split it into smaller top-ups.` };
      }

      const total = credits + bonus;
      const priceUsd = (priceCents / 100).toFixed(2);

      // ── Saved card? ──
      const customerId = await getOrCreateStripeCustomer(ctx.userId);
      const card = await getDefaultPaymentMethod(customerId);
      if (!card) {
        return {
          ok: false,
          error_code: "no_payment_method",
          message: `The user has no saved card, so tell them to add one at ${CARD_ADD_URL} (their chat stays here), then say you'll top them up once it's added.`,
          meta: { addCardUrl: CARD_ADD_URL, credits: total, priceUsd },
        };
      }

      // ── Confirm card (exact $ + card) — money only moves on Confirm ──
      const summary = `Buy ${total.toLocaleString()} credits for $${priceUsd} — charged to ${card.brand} •••• ${card.last4}`;
      const steps: PlanStep[] = [{ id: "s1", title: `Buy ${total.toLocaleString()} credits — $${priceUsd}`, detail: `Charged to your saved ${card.brand} ending ${card.last4}` }];
      const planId = `plan_${randomUUID().slice(0, 12)}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      try {
        const seq = await nextSeqForConversation(ctx.conversationId);
        await prisma.agentPlanProposal.create({
          data: {
            id: planId,
            conversationId: ctx.conversationId,
            messageId: ctx.messageId,
            userId: ctx.userId,
            summary,
            steps: JSON.stringify(steps),
            totalCreditCost: 0,
            status: "pending",
            expiresAt,
            seq,
          },
        });
      } catch { /* non-fatal — awaitConfirmation still gates the charge */ }
      ctx.emit({ type: "plan_proposal", id: planId, steps, summary, totalCreditCost: 0 });
      const confirmed = await ctx.awaitConfirmation(planId);
      try {
        const cur = await prisma.agentPlanProposal.findUnique({ where: { id: planId }, select: { status: true } });
        if (!cur || cur.status === "pending") {
          await prisma.agentPlanProposal.update({ where: { id: planId }, data: { status: confirmed ? "confirmed" : "expired", resolvedAt: new Date() } });
        }
      } catch { /* ignore */ }
      if (!confirmed) {
        return { ok: false, error_code: "user_canceled", message: "The user didn't confirm the purchase. Don't charge anything — ask if they'd like a different amount, or to continue without buying.", recoverable: true };
      }

      // ── Charge the saved card (merchant-initiated / off-session) ──
      let pi: { status: string; paymentIntentId: string };
      try {
        pi = resolvedPackageId
          ? await createCreditPaymentIntent({ userId: ctx.userId, packageId: resolvedPackageId, customerId, paymentMethodId: card.id, offSession: true })
          : await createCustomCreditPaymentIntent({ userId: ctx.userId, customerId, paymentMethodId: card.id, credits, priceCents, offSession: true });
      } catch (e: any) {
        // Cards that require 3DS throw authentication_required on an off-session charge.
        const code = e?.code || e?.raw?.code;
        if (code === "authentication_required") {
          return { ok: false, error_code: "upstream_failed", message: `That card needs extra verification for this charge. Tell the user to complete the top-up at ${CARD_ADD_URL} (it handles the security check), then you'll continue.`, meta: { addCardUrl: CARD_ADD_URL }, recoverable: true };
        }
        return { ok: false, error_code: "upstream_failed", message: `The card was declined or the charge failed (${e?.message || "payment error"}). Suggest a different card at ${CARD_ADD_URL}.`, recoverable: true };
      }

      if (pi.status !== "succeeded") {
        return { ok: false, error_code: "upstream_failed", message: `The payment didn't complete (status: ${pi.status}). Tell the user to finish it at ${CARD_ADD_URL}, then you'll continue.`, meta: { addCardUrl: CARD_ADD_URL }, recoverable: true };
      }

      // ── Add the credits (idempotent — the webhook uses the same guard) ──
      const existing = await prisma.creditTransaction.findFirst({
        where: { referenceId: pi.paymentIntentId, referenceType: "stripe_payment" },
        select: { id: true },
      });
      if (!existing) {
        await creditService.addCredits({
          userId: ctx.userId,
          type: TRANSACTION_TYPES.PURCHASE,
          amount: total,
          description: `Purchased ${credits} credits${bonus > 0 ? ` + ${bonus} bonus` : ""}${resolvedPackageId ? ` (${resolvedPackageId})` : " (custom)"} — in chat`,
          referenceType: "stripe_payment",
          referenceId: pi.paymentIntentId,
        });
      }

      const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
      const newBalance = user?.aiCredits ?? 0;

      return {
        ok: true,
        data: {
          purchased: true,
          creditsAdded: total,
          priceUsd,
          newBalance,
          message: `Added ${total.toLocaleString()} credits (new balance ${newBalance.toLocaleString()}). Tell the user briefly, then CONTINUE the task they originally wanted — don't make them re-ask.`,
        },
        resultRefType: "CreditTransaction",
        resultRefId: pi.paymentIntentId,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Couldn't complete the top-up." };
    }
  },
};
