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
  paymentBackupReady?: boolean | null;
  paymentBackupLabel?: string | null;
  paymentBackupReason?: string | null;
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

export function isListSmartlyAccountEligible(user?: UserBillingShape | null) {
  return Boolean(user && !user.deletedAt);
}

export function requiresListSmartlyPaymentBackup(userOrPlan?: UserBillingShape | string | null) {
  return !isListSmartlyPlanEligible(userOrPlan);
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
  user?: UserBillingShape | null
) {
  return (
    Boolean(profile) &&
    isListSmartlyAccountEligible(user || null) &&
    getListSmartlyCreditStatus(profile) === LISTSMARTLY_CREDIT_STATUS_ACTIVE
  );
}

export function buildListSmartlyAccess(
  profile?: ProfileBillingShape | null,
  user?: UserBillingShape | null
) {
  const creditStatus = getListSmartlyCreditStatus(profile);
  const planEligible = isListSmartlyPlanEligible(user || null);
  const accountEligible = isListSmartlyAccountEligible(user || null);
  const backupPaymentRequired = requiresListSmartlyPaymentBackup(user || null);
  const backupPaymentReady = user?.paymentBackupReady ?? null;
  const backupPaymentSatisfied = !backupPaymentRequired || backupPaymentReady !== false;
  const active = Boolean(
    profile &&
      accountEligible &&
      backupPaymentSatisfied &&
      creditStatus === LISTSMARTLY_CREDIT_STATUS_ACTIVE
  );
  const status = !profile
    ? LISTSMARTLY_CREDIT_STATUS_LOCKED
    : !accountEligible
      ? "account_inactive"
      : backupPaymentRequired && backupPaymentReady === false
        ? "payment_method_required"
        : creditStatus;

  return {
    active,
    status,
    creditStatus,
    legacyStatus: profile?.lsSubscriptionStatus || "inactive",
    plan: LISTSMARTLY_INCLUDED_PLAN,
    planName: planEligible ? "Included with FlowSmartly plan" : "Credit access with backup payment method",
    unlockCost: LISTSMARTLY_UNLOCK_CREDIT_COST,
    monthlyCost: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
    creditsAvailable: user?.aiCredits || 0,
    planEligible,
    accountEligible,
    subscriptionBacked: planEligible,
    backupPaymentRequired,
    paymentBackupReady: backupPaymentReady,
    paymentBackupLabel: user?.paymentBackupLabel || null,
    paymentBackupReason: user?.paymentBackupReason || null,
    unlockedAt: profile?.listSmartlyUnlockedAt || null,
    lastCreditChargeAt: profile?.listSmartlyLastCreditChargeAt || null,
    nextCreditChargeAt: profile?.listSmartlyNextCreditChargeAt || null,
    lastCreditFailureAt: profile?.listSmartlyLastCreditFailureAt || null,
    creditFailureReason: profile?.listSmartlyCreditFailureReason || null,
  };
}
