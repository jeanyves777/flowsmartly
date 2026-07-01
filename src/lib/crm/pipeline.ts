import { prisma } from "@/lib/db/client";

/** Default B2B pipeline stages, seeded per-user on first use. Configurable later. */
export const DEFAULT_STAGES: { name: string; order: number; isWon?: boolean; isLost?: boolean }[] = [
  { name: "New", order: 0 },
  { name: "Contacted", order: 1 },
  { name: "Qualified", order: 2 },
  { name: "Proposal", order: 3 },
  { name: "Negotiation", order: 4 },
  { name: "Won", order: 5, isWon: true },
  { name: "Lost", order: 6, isLost: true },
];

/** Ensure the user has pipeline stages; seed the defaults the first time. Returns
 * the user's stages ordered. */
export async function ensureDefaultStages(userId: string) {
  const existing = await prisma.pipelineStage.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
  if (existing.length > 0) return existing;

  await prisma.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({
      userId,
      name: s.name,
      order: s.order,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
    })),
  });
  return prisma.pipelineStage.findMany({ where: { userId }, orderBy: { order: "asc" } });
}
