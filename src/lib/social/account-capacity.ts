import { prisma } from "@/lib/db/client";
import { getSocialAccountLimit } from "@/lib/social/account-limits";

export const SOCIAL_ACCOUNT_UNLOCK_CREDIT_COST = 250;

export const SOCIAL_ACCOUNT_UNLOCK_PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "whatsapp",
] as const;

export type SocialAccountUnlockPlatform = (typeof SOCIAL_ACCOUNT_UNLOCK_PLATFORMS)[number];

export type ActiveSocialAccount = {
  platform: string;
};

export type SocialConnectionCapacity = {
  baseLimit: number | null;
  effectiveLimit: number | null;
  totalUnlockedSlots: number;
  platformSlots: Record<string, number>;
  platformCreditsSpent: Record<string, number>;
  activeAccounts: ActiveSocialAccount[];
};

export function baseSocialPlatform(platform: string): string {
  if (platform.startsWith("facebook_")) return "facebook";
  if (platform.startsWith("instagram_")) return "instagram";
  return platform;
}

export function normalizeUnlockPlatform(platform: string | null | undefined): SocialAccountUnlockPlatform | null {
  const normalized = baseSocialPlatform(String(platform || "").trim().toLowerCase());
  return SOCIAL_ACCOUNT_UNLOCK_PLATFORMS.includes(normalized as SocialAccountUnlockPlatform)
    ? (normalized as SocialAccountUnlockPlatform)
    : null;
}

export async function getSocialConnectionCapacity(
  userId: string,
  plan?: string | null,
  activeAccounts?: ActiveSocialAccount[]
): Promise<SocialConnectionCapacity> {
  const [accounts, unlockRows] = await Promise.all([
    activeAccounts
      ? Promise.resolve(activeAccounts)
      : prisma.socialAccount.findMany({
          where: { userId, isActive: true },
          select: { platform: true },
        }),
    prisma.socialAccountConnectionUnlock.groupBy({
      by: ["platform"],
      where: { userId },
      _sum: { slots: true, creditsSpent: true },
    }),
  ]);

  const platformSlots: Record<string, number> = {};
  const platformCreditsSpent: Record<string, number> = {};
  for (const row of unlockRows) {
    const platform = normalizeUnlockPlatform(row.platform);
    if (!platform) continue;
    platformSlots[platform] = (platformSlots[platform] || 0) + (row._sum.slots || 0);
    platformCreditsSpent[platform] = (platformCreditsSpent[platform] || 0) + (row._sum.creditsSpent || 0);
  }

  const totalUnlockedSlots = Object.values(platformSlots).reduce((sum, slots) => sum + slots, 0);
  const baseLimit = getSocialAccountLimit(plan);

  return {
    baseLimit,
    effectiveLimit: baseLimit === null ? null : baseLimit + totalUnlockedSlots,
    totalUnlockedSlots,
    platformSlots,
    platformCreditsSpent,
    activeAccounts: accounts,
  };
}

export function canUseSocialAccountSlot(
  capacity: SocialConnectionCapacity,
  platform: string,
  pendingTotalSlots = 0,
  pendingPlatformSlots = 0
): boolean {
  if (capacity.baseLimit === null) return true;

  const platformKey = normalizeUnlockPlatform(platform);
  if (!platformKey) return false;

  const activeTotal = capacity.activeAccounts.length + pendingTotalSlots;
  if (activeTotal < capacity.baseLimit) return true;

  const activePlatformCount =
    capacity.activeAccounts.filter((account) => baseSocialPlatform(account.platform) === platformKey).length +
    pendingPlatformSlots;
  const activeOtherCount = activeTotal - activePlatformCount;
  const includedSlotsAvailableForPlatform = Math.max(0, capacity.baseLimit - activeOtherCount);
  const allowedPlatformCount = includedSlotsAvailableForPlatform + (capacity.platformSlots[platformKey] || 0);

  return activePlatformCount < allowedPlatformCount;
}

export function remainingUnlockedPlatformSlots(capacity: SocialConnectionCapacity, platform: string): number {
  const platformKey = normalizeUnlockPlatform(platform);
  if (!platformKey) return 0;
  if (capacity.baseLimit === null) return Number.POSITIVE_INFINITY;

  const activePlatformCount = capacity.activeAccounts.filter(
    (account) => baseSocialPlatform(account.platform) === platformKey
  ).length;
  const activeOtherCount = capacity.activeAccounts.length - activePlatformCount;
  const includedSlotsAvailableForPlatform = Math.max(0, capacity.baseLimit - activeOtherCount);
  const platformAccountsUsingUnlocks = Math.max(0, activePlatformCount - includedSlotsAvailableForPlatform);
  return Math.max(0, (capacity.platformSlots[platformKey] || 0) - platformAccountsUsingUnlocks);
}
