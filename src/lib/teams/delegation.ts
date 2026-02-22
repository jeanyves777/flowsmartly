/**
 * Team Delegation System
 *
 * Allows team members to use features on behalf of the team owner,
 * subject to per-feature permission limits.
 *
 * Credit flow: member uses feature → deducted from OWNER's aiCredits balance,
 * tracked against the member's ProjectMember.creditsUsed and MemberPermission.usedCount.
 * Credit allowance is based on the owner's available credits, not a separate per-member number.
 */

import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, type CreditCostKey } from "@/lib/credits/costs";

export interface DelegationCheckResult {
  allowed: boolean;
  ownerId?: string;
  projectMemberId?: string;
  creditCost?: number;
  reason?: string;
}

/**
 * Check if a user has delegated access to a feature via any project membership.
 *
 * Searches all ProjectMember records for the user where:
 * - canActOnBehalf is true
 * - isRevoked is false
 * - expiresAt hasn't passed (or is null)
 * - MemberPermission for the featureKey exists
 * - Usage hasn't exceeded maxUsage
 * - Owner has enough credits (aiCredits >= creditCost)
 *
 * Returns the first matching delegation.
 */
export async function checkDelegatedAccess(
  userId: string,
  featureKey: CreditCostKey
): Promise<DelegationCheckResult> {
  const creditCost = await getDynamicCreditCost(featureKey);

  // Find all active project memberships with delegation rights
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId,
      canActOnBehalf: true,
      isRevoked: false,
    },
    include: {
      permissions: {
        where: { featureKey },
      },
      project: {
        include: {
          team: {
            select: { ownerId: true },
          },
        },
      },
    },
  });

  for (const membership of memberships) {
    // Check expiry
    if (membership.expiresAt && membership.expiresAt < new Date()) {
      continue;
    }

    // Check if feature permission exists
    const permission = membership.permissions[0];
    if (!permission) {
      continue;
    }

    // Check usage limit (-1 means unlimited)
    if (permission.maxUsage !== -1 && permission.usedCount >= permission.maxUsage) {
      continue;
    }

    const ownerId = membership.project?.team?.ownerId;
    if (!ownerId) {
      continue;
    }

    // Check owner's actual credit balance
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { aiCredits: true },
    });

    if (!owner || owner.aiCredits < creditCost) {
      continue;
    }

    return {
      allowed: true,
      ownerId,
      projectMemberId: membership.id,
      creditCost,
    };
  }

  return {
    allowed: false,
    reason: "No active delegation found for this feature",
  };
}

/**
 * Record that a delegated member used a feature.
 * Increments MemberPermission.usedCount and ProjectMember.creditsUsed.
 */
export async function recordDelegatedUsage(
  projectMemberId: string,
  featureKey: string,
  creditCost: number
): Promise<void> {
  await prisma.$transaction([
    // Increment feature usage count
    prisma.memberPermission.updateMany({
      where: { projectMemberId, featureKey },
      data: { usedCount: { increment: 1 } },
    }),
    // Increment total credits used by this member
    prisma.projectMember.update({
      where: { id: projectMemberId },
      data: { creditsUsed: { increment: creditCost } },
    }),
  ]);
}

/**
 * Get delegation summary for a user — all active delegations across projects.
 */
export async function getUserDelegations(userId: string) {
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId,
      canActOnBehalf: true,
      isRevoked: false,
    },
    include: {
      permissions: true,
      project: {
        include: {
          team: {
            select: { id: true, name: true, ownerId: true },
          },
        },
      },
    },
  });

  // Collect unique owner IDs to fetch their names and credit balances
  const ownerIds = [...new Set(memberships.map((m) => m.project.team?.ownerId).filter(Boolean))] as string[];
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, avatarUrl: true, aiCredits: true },
  });
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return memberships
    .filter((m) => !m.expiresAt || m.expiresAt > new Date())
    .map((m) => {
      const ownerId = m.project.team?.ownerId || "";
      const owner = ownerMap.get(ownerId);
      return {
        projectMemberId: m.id,
        projectId: m.projectId,
        projectName: m.project.name,
        teamId: m.project.team?.id,
        teamName: m.project.team?.name,
        ownerId,
        ownerName: owner?.name || "Unknown",
        ownerAvatarUrl: owner?.avatarUrl || null,
        ownerAvailableCredits: owner?.aiCredits ?? 0,
        creditsUsed: m.creditsUsed,
        expiresAt: m.expiresAt?.toISOString() || null,
        permissions: m.permissions.map((p) => ({
          featureKey: p.featureKey,
          maxUsage: p.maxUsage,
          usedCount: p.usedCount,
        })),
      };
    });
}
