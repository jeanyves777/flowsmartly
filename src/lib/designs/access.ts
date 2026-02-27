import { prisma } from "@/lib/db/client";

export type DesignRole = "OWNER" | "EDITOR" | "VIEWER";

interface AccessResult {
  allowed: boolean;
  role: DesignRole | null;
}

/**
 * Check if a user has access to a design and what role they have.
 * Checks: owner → accepted collaborator (EDITOR/VIEWER)
 */
export async function checkDesignAccess(
  designId: string,
  userId: string
): Promise<AccessResult> {
  // Check ownership
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { userId: true },
  });

  if (!design) return { allowed: false, role: null };
  if (design.userId === userId) return { allowed: true, role: "OWNER" };

  // Check collaboration
  const collab = await prisma.designCollaborator.findUnique({
    where: { designId_userId: { designId, userId } },
    select: { role: true, status: true },
  });

  if (collab && collab.status === "ACCEPTED") {
    return { allowed: true, role: collab.role as DesignRole };
  }

  return { allowed: false, role: null };
}

/**
 * Check if a user can edit a design (owner or EDITOR collaborator).
 */
export async function canEditDesign(
  designId: string,
  userId: string
): Promise<boolean> {
  const { allowed, role } = await checkDesignAccess(designId, userId);
  return allowed && (role === "OWNER" || role === "EDITOR");
}

interface ShareTokenResult {
  valid: boolean;
  designId: string;
  permission: "VIEW" | "EDIT" | "COPY";
  shareId: string;
}

/**
 * Validate a share token and return its access level.
 */
export async function checkShareTokenAccess(
  token: string
): Promise<ShareTokenResult | null> {
  const share = await prisma.designShare.findUnique({
    where: { token },
    select: {
      id: true,
      designId: true,
      permission: true,
      isActive: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
    },
  });

  if (!share) return null;
  if (!share.isActive) return null;
  if (share.expiresAt && share.expiresAt < new Date()) return null;
  if (share.maxUses && share.useCount >= share.maxUses) return null;

  return {
    valid: true,
    designId: share.designId,
    permission: share.permission as "VIEW" | "EDIT" | "COPY",
    shareId: share.id,
  };
}

/**
 * Record a design activity event.
 */
export async function recordDesignActivity(
  designId: string,
  userId: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.designActivity.create({
      data: {
        designId,
        userId,
        action,
        details: JSON.stringify(details),
      },
    });
  } catch {
    // Non-critical — don't throw
  }
}
