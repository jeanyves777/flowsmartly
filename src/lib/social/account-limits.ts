export const SOCIAL_ACCOUNT_LIMITS: Record<string, number | null> = {
  STARTER: 2,
  NON_PROFIT: 5,
  PRO: 10,
  BUSINESS: 25,
  ENTERPRISE: null,
};

export function getSocialAccountLimit(plan?: string | null): number | null {
  if (!plan) return SOCIAL_ACCOUNT_LIMITS.STARTER;
  return Object.prototype.hasOwnProperty.call(SOCIAL_ACCOUNT_LIMITS, plan)
    ? SOCIAL_ACCOUNT_LIMITS[plan]
    : SOCIAL_ACCOUNT_LIMITS.STARTER;
}

export function formatSocialAccountLimit(limit: number | null): string {
  return limit === null ? "Unlimited" : `${limit}`;
}
