import { prisma } from "@/lib/db/client";

/**
 * Synthetic (internal seed) feed-engagement system — shared constants & config.
 *
 * These accounts are real `User` rows flagged `isSynthetic = true`. They exist
 * purely to seed activity on FlowSmartly's OWN native feed (likes, comments,
 * follows, views, posts) so real users land on a lively feed. They never touch
 * any external platform, are never billed, never emailed, never paid out.
 */

/** Non-routable email domain for every synthetic account. Email send is hard-
 * blocked for this domain (see src/lib/email/core.ts), so transactional mail,
 * notifications and campaigns can never reach a bot inbox. */
export const SYNTHETIC_EMAIL_DOMAIN = "seed.flowsmartly.internal";

export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

export const SYNTHETIC_CONFIG_ID = "singleton";

export interface PlanCaps {
  /** Daily synthetic interaction cap for free/internal plans (STARTER etc.). */
  free: number;
  /** Daily cap for any paying plan not in `overrides`. */
  paid: number;
  /** Per-plan-name overrides, e.g. { PRO: 300, PREMIUM: 600 }. */
  overrides: Record<string, number>;
}

export interface SyntheticGlobalConfig {
  enabled: boolean;
  intensity: number; // 0–100 global activity multiplier
  niches: string[];
  planCaps: PlanCaps;
}

/** Plans treated as non-paying for engagement tiering. */
export const FREE_PLANS = new Set(["STARTER", "ADMIN", "SUPER_ADMIN", "AGENT"]);

export const DEFAULT_PLAN_CAPS: PlanCaps = { free: 5, paid: 150, overrides: {} };

function parsePlanCaps(raw: string | null | undefined): PlanCaps {
  try {
    const o = JSON.parse(raw || "{}");
    return {
      free: typeof o.free === "number" ? o.free : DEFAULT_PLAN_CAPS.free,
      paid: typeof o.paid === "number" ? o.paid : DEFAULT_PLAN_CAPS.paid,
      overrides: o.overrides && typeof o.overrides === "object" ? o.overrides : {},
    };
  } catch {
    return { ...DEFAULT_PLAN_CAPS };
  }
}

/** Resolve a real user's daily synthetic-interaction cap from their plan. */
export function resolvePlanCap(plan: string | null | undefined, caps: PlanCaps): number {
  const p = plan || "STARTER";
  if (caps.overrides && typeof caps.overrides[p] === "number") return caps.overrides[p];
  return FREE_PLANS.has(p) ? caps.free : caps.paid;
}

/** Read the global switchboard, creating the singleton on first access. */
export async function getSyntheticConfig(): Promise<SyntheticGlobalConfig> {
  const row = await prisma.syntheticConfig.upsert({
    where: { id: SYNTHETIC_CONFIG_ID },
    create: { id: SYNTHETIC_CONFIG_ID },
    update: {},
  });
  let niches: string[] = [];
  try {
    niches = JSON.parse(row.niches || "[]");
  } catch {
    niches = [];
  }
  return {
    enabled: row.enabled,
    intensity: row.intensity,
    niches,
    planCaps: parsePlanCaps(row.planCaps),
  };
}

export async function setSyntheticConfig(
  patch: Partial<SyntheticGlobalConfig>
): Promise<SyntheticGlobalConfig> {
  const data: Record<string, unknown> = {};
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.intensity !== undefined)
    data.intensity = Math.max(0, Math.min(100, Math.round(patch.intensity)));
  if (patch.niches !== undefined) data.niches = JSON.stringify(patch.niches);
  if (patch.planCaps !== undefined) {
    const c = patch.planCaps;
    data.planCaps = JSON.stringify({
      free: Math.max(0, Math.round(c.free)),
      paid: Math.max(0, Math.round(c.paid)),
      overrides: c.overrides || {},
    });
  }

  await prisma.syntheticConfig.upsert({
    where: { id: SYNTHETIC_CONFIG_ID },
    create: { id: SYNTHETIC_CONFIG_ID, ...data },
    update: data,
  });
  return getSyntheticConfig();
}
