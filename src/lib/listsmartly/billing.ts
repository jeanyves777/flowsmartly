import {
  LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
  LISTSMARTLY_UNLOCK_CREDIT_COST,
} from "@/lib/constants/listsmartly";

export const LISTSMARTLY_INCLUDED_PLAN = "included";
export const LISTSMARTLY_CREDIT_STATUS_LOCKED = "locked";
export const LISTSMARTLY_CREDIT_STATUS_ACTIVE = "active";
export const LISTSMARTLY_CREDIT_STATUS_PAST_DUE = "past_due";

const LEGACY_ACTIVE_STATUSES = new Set(["active", "trialing"]);

type ProfileBillingShape = {
  lsSubscriptionStatus?: string | null;
  listSmartlyCreditStatus?: string | null;
  listSmartlyUnlockedAt?: Date | string | null;
  listSmartlyLastCreditChargeAt?: Date | string | null;
  listSmartlyNextCreditChargeAt?: Date | string | null;
  listSmartlyLastCreditFailureAt?: Date | string | null;
  listSmartlyCreditFailureReason?: string | null;
};

type UserBillingShape = {
  plan?: string | null;
  aiCredits?: number | null;
  deletedAt?: Date | string | null;
};

export function addListSmartlyBillingMonth(from = new Date()) {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function isListSmartlyPlanEligible(userOrPlan?: UserBillingShape | string | null) {
  const plan = typeof userOrPlan === "string" ? userOrPlan : userOrPlan?.plan;
  const deletedAt = typeof userOrPlan === "string" ? null : userOrPlan?.deletedAt;

  return Boolean(plan && plan !== "STARTER" && !deletedAt);
}

export function getListSmartlyCreditStatus(profile?: ProfileBillingShape | null) {
  if (!profile) return LISTSMARTLY_CREDIT_STATUS_LOCKED;

  if (
    profile.listSmartlyCreditStatus &&
    profile.listSmartlyCreditStatus !== LISTSMARTLY_CREDIT_STATUS_LOCKED
  ) {
    return profile.listSmartlyCreditStatus;
  }

  if (profile.lsSubscriptionStatus && LEGACY_ACTIVE_STATUSES.has(profile.lsSubscriptionStatus)) {
    return LISTSMARTLY_CREDIT_STATUS_ACTIVE;
  }

  if (profile.lsSubscriptionStatus === LISTSMARTLY_CREDIT_STATUS_PAST_DUE) {
    return LISTSMARTLY_CREDIT_STATUS_PAST_DUE;
  }

  return profile.listSmartlyCreditStatus || LISTSMARTLY_CREDIT_STATUS_LOCKED;
}

export function isListSmartlyAccessActive(
  profile?: ProfileBillingShape | null,
  userOrPlan?: UserBillingShape | string | null
) {
  return (
    Boolean(profile) &&
    isListSmartlyPlanEligible(userOrPlan) &&
    getListSmartlyCreditStatus(profile) === LISTSMARTLY_CREDIT_STATUS_ACTIVE
  );
}

export function buildListSmartlyAccess(
  profile?: ProfileBillingShape | null,
  user?: UserBillingShape | null
) {
  const creditStatus = getListSmartlyCreditStatus(profile);
  const planEligible = isListSmartlyPlanEligible(user || null);
  const active = Boolean(profile && planEligible && creditStatus === LISTSMARTLY_CREDIT_STATUS_ACTIVE);

  return {
    active,
    status: !profile ? LISTSMARTLY_CREDIT_STATUS_LOCKED : planEligible ? creditStatus : "plan_required",
    creditStatus,
    legacyStatus: profile?.lsSubscriptionStatus || "inactive",
    plan: LISTSMARTLY_INCLUDED_PLAN,
    planName: "Included with FlowSmartly",
    unlockCost: LISTSMARTLY_UNLOCK_CREDIT_COST,
    monthlyCost: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
    creditsAvailable: user?.aiCredits || 0,
    planEligible,
    unlockedAt: profile?.listSmartlyUnlockedAt || null,
    lastCreditChargeAt: profile?.listSmartlyLastCreditChargeAt || null,
    nextCreditChargeAt: profile?.listSmartlyNextCreditChargeAt || null,
    lastCreditFailureAt: profile?.listSmartlyLastCreditFailureAt || null,
    creditFailureReason: profile?.listSmartlyCreditFailureReason || null,
  };
}

