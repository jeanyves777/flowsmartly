import { prisma } from "@/lib/db/client";

/**
 * Return the set of user IDs that should be invisible to `viewerId` because
 * of a UserBlock in EITHER direction.
 *
 * Mutual invisibility: if A blocks B, neither A nor B sees the other's posts,
 * comments, or follow suggestions. This helper returns the union so callers
 * can drop the result straight into a Prisma `notIn` filter on `userId` /
 * `authorId`.
 *
 * Returns an empty array when `viewerId` is falsy (anonymous viewer — there
 * is no "me" to block from).
 */
export async function getBlockedUserIds(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];

  const [blocked, blockedBy] = await Promise.all([
    prisma.userBlock.findMany({
      where: { blockerId: viewerId },
      select: { blockedId: true },
    }),
    prisma.userBlock.findMany({
      where: { blockedId: viewerId },
      select: { blockerId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const row of blocked) ids.add(row.blockedId);
  for (const row of blockedBy) ids.add(row.blockerId);
  return Array.from(ids);
}
