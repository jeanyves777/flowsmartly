import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { reconcileListingCatalog } from "@/lib/listsmartly/sync-engine";
import {
  addListSmartlyBillingMonth,
  getListSmartlyCreditStatus,
  isListSmartlyAccountEligible,
  LISTSMARTLY_CREDIT_STATUS_ACTIVE,
  requiresListSmartlyPaymentBackup,
} from "@/lib/listsmartly/billing";
import { getListSmartlyPaymentBackup } from "@/lib/listsmartly/payment-backup";
import { LISTSMARTLY_UNLOCK_CREDIT_COST } from "@/lib/constants/listsmartly";
import type { FlowAgentTool } from "../registry";

/**
 * setup_local_presence — the agent sets up the user's "Reviews & local SEO"
 * (ListSmartly) presence FOR them: it unlocks ListSmartly (first time charges
 * the unlock credits), creates/updates the business profile with the NAP +
 * business details the user gave (or that we infer from their Brand Kit), and
 * seeds the directory catalog so listings + the local-SEO score appear on the
 * Reviews surface. Mirrors POST /api/listsmartly/activate + PUT /profile, then
 * reconcileListingCatalog — no reimplementation of billing logic.
 *
 * Mutating + confirmed plan. The unlock cost is real credits, so confirm via
 * propose_plan (pass costKey AGENT_SETUP_LOCAL_PRESENCE — it resolves to the
 * unlock credit cost). Lands at /home/reviews. [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const setupLocalPresence: FlowAgentTool = {
  name: "setup_local_presence",
  description:
    "Set up the user's local business presence (Reviews & local SEO / ListSmartly) FOR them. Use when the user wants to get listed on directories, track reviews, or improve local SEO. Collect/INFER the business name + NAP (phone, email, website, address, city, state, zip) and industry from their words or Brand Kit — only ask for things you truly can't know. This UNLOCKS ListSmartly (first time charges the unlock credits) and seeds their directory catalog so listings + a local-SEO score appear. EXPENSIVE on first unlock — confirm via propose_plan (costKey AGENT_SETUP_LOCAL_PRESENCE). Pass `planId` from a confirmed propose_plan. Lands at /home/reviews. If already set up, it just updates the profile (free).",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      businessName: { type: "string", description: "Business name. Infer from Brand Kit if not given." },
      industry: { type: "string", description: "Industry/category, e.g. 'restaurant', 'plumbing'. Infer from the user/Brand Kit." },
      phone: { type: "string", description: "Business phone (NAP). Only the user knows this — ask if missing." },
      email: { type: "string", description: "Business email (NAP)." },
      website: { type: "string", description: "Business website URL." },
      address: { type: "string", description: "Street address (NAP)." },
      city: { type: "string", description: "City." },
      state: { type: "string", description: "State / region (2-letter code for US)." },
      zip: { type: "string", description: "ZIP / postal code." },
      country: { type: "string", description: "Country (ISO, e.g. 'US')." },
      description: { type: "string", description: "Short business description used on directory listings — infer an on-brand one if not given." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_SETUP_LOCAL_PRESENCE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const billingUser = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, plan: true, aiCredits: true, deletedAt: true, stripeCustomerId: true, name: true },
      });
      if (!billingUser || !isListSmartlyAccountEligible(billingUser)) {
        return { ok: false, error_code: "permission_denied", message: "The account must be active to set up local presence." };
      }

      // Backup-payment gate for non-subscription accounts (mirrors /activate).
      const backupRequired = requiresListSmartlyPaymentBackup(billingUser);
      if (backupRequired) {
        const backup = await getListSmartlyPaymentBackup(billingUser.stripeCustomerId);
        if (!backup.ready) {
          return {
            ok: false,
            error_code: "permission_denied",
            message: "A backup payment method is required before unlocking local presence on this plan. Point the user to add a card on the Reviews surface, then retry.",
          };
        }
      }

      // Resolve a name + sensible defaults from the Brand Kit when the user didn't say.
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true, industry: true, phone: true, email: true, website: true, address: true, description: true },
      });

      const name =
        clean(input.businessName, 200) || brandKit?.name || billingUser.name || "My Business";
      const industry = clean(input.industry, 100) || brandKit?.industry || null;

      const existing = await prisma.listSmartlyProfile.findUnique({ where: { userId: ctx.userId } });
      const alreadyUnlocked =
        Boolean(existing?.listSmartlyUnlockedAt) ||
        getListSmartlyCreditStatus(existing) === LISTSMARTLY_CREDIT_STATUS_ACTIVE;
      const chargeAmount = alreadyUnlocked ? 0 : LISTSMARTLY_UNLOCK_CREDIT_COST;

      if (!ctx.isAdmin && chargeAmount > 0 && (billingUser.aiCredits ?? 0) < chargeAmount) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Unlocking local presence costs ${chargeAmount} credits. The user has ${billingUser.aiCredits ?? 0}.`,
          meta: { need: chargeAmount, have: billingUser.aiCredits ?? 0 },
        };
      }

      const now = new Date();
      const accessData = {
        lsPlan: "included",
        lsSubscriptionStatus: "active",
        listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_ACTIVE,
        listSmartlyUnlockedAt: existing?.listSmartlyUnlockedAt || now,
        listSmartlyLastCreditChargeAt: chargeAmount > 0 ? now : existing?.listSmartlyLastCreditChargeAt || null,
        listSmartlyNextCreditChargeAt: existing?.listSmartlyNextCreditChargeAt || addListSmartlyBillingMonth(now),
        listSmartlyLastCreditFailureAt: null,
        listSmartlyCreditFailureReason: null,
      };

      // Optional NAP / detail fields the user/Brand Kit supplied.
      const napData: Record<string, unknown> = {};
      const napFields: [string, number][] = [
        ["phone", 50], ["email", 200], ["website", 300], ["address", 300],
        ["city", 120], ["state", 60], ["zip", 20], ["country", 60], ["description", 1000],
      ];
      for (const [field, max] of napFields) {
        const v = input[field];
        if (v !== undefined && v !== null && String(v).trim()) napData[field] = clean(v, max);
      }
      // Backfill a couple of fields from the Brand Kit when neither user nor profile has them.
      if (napData.phone === undefined && !existing?.phone && brandKit?.phone) napData.phone = brandKit.phone;
      if (napData.website === undefined && !existing?.website && brandKit?.website) napData.website = brandKit.website;

      const profile = existing
        ? await prisma.listSmartlyProfile.update({
            where: { id: existing.id },
            data: {
              ...accessData,
              ...napData,
              businessName: clean(input.businessName, 200) || existing.businessName || name,
              industry: industry || existing.industry || null,
            },
          })
        : await prisma.listSmartlyProfile.create({
            data: {
              userId: ctx.userId,
              businessName: name,
              industry,
              ...accessData,
              ...napData,
            },
          });

      if (!ctx.isAdmin && chargeAmount > 0) {
        await creditService.deductCredits({
          userId: ctx.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount: chargeAmount,
          referenceType: "listsmartly_unlock",
          referenceId: profile.id,
          description: "Flow-AI: ListSmartly local presence unlock",
        });
      }

      let createdCount = 0;
      try {
        const recon = await reconcileListingCatalog(profile.id);
        createdCount = recon.created;
      } catch (err) {
        console.error("[setup_local_presence] catalog reconcile failed:", err);
      }

      return {
        ok: true,
        data: {
          profileId: profile.id,
          chargedCredits: ctx.isAdmin ? 0 : chargeAmount,
          directoriesSeeded: createdCount,
          link: "/home/reviews",
          summary: `${alreadyUnlocked ? "Updated" : "Set up"} the local presence for "${profile.businessName}"${industry ? ` (${industry})` : ""} and seeded the directory catalog. Tell the user in ONE short sentence it's ready on the Reviews surface, and suggest running a directory scan there to detect existing listings.`,
        },
        resultRefType: "ListSmartlyProfile",
        resultRefId: profile.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to set up local presence" };
    }
  },
};
