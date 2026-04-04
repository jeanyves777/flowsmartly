/**
 * Sync engine orchestrator for ListSmartly.
 * Creates and manages listing scan/sync jobs.
 */
import { prisma } from "@/lib/db/client";
import { checkConsistency } from "./consistency-checker";

/** Create listing records for all directories matching a profile's industry. */
export async function initializeListings(profileId: string, industry?: string): Promise<number> {
  const directories = await prisma.listingDirectory.findMany({
    where: { isActive: true },
    select: { id: true, industries: true },
  });

  const relevantDirs = directories.filter((d) => {
    const industries: string[] = JSON.parse(d.industries || "[]");
    return industries.length === 0 || (industry && industries.includes(industry.toLowerCase()));
  });

  let count = 0;
  for (const dir of relevantDirs) {
    await prisma.businessListing.upsert({
      where: { profileId_directoryId: { profileId, directoryId: dir.id } },
      update: {},
      create: { profileId, directoryId: dir.id, status: "missing" },
    });
    count++;
  }

  // Update profile stats
  await prisma.listSmartlyProfile.update({
    where: { id: profileId },
    data: { totalListings: count },
  });

  return count;
}

/** Run a consistency check across all live listings for a profile. */
export async function runConsistencyCheck(profileId: string): Promise<{ checked: number; inconsistent: number }> {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found");

  const listings = await prisma.businessListing.findMany({
    where: { profileId, status: { in: ["live", "submitted", "claimed"] } },
  });

  let inconsistent = 0;
  for (const listing of listings) {
    const result = checkConsistency(profile, listing);
    if (result.isConsistent !== listing.isConsistent || JSON.stringify(result.inconsistencies) !== listing.inconsistencies) {
      await prisma.businessListing.update({
        where: { id: listing.id },
        data: {
          isConsistent: result.isConsistent,
          inconsistencies: JSON.stringify(result.inconsistencies),
          lastCheckedAt: new Date(),
        },
      });
    }
    if (!result.isConsistent) inconsistent++;
  }

  return { checked: listings.length, inconsistent };
}

/** Create a sync job record. */
export async function createSyncJob(
  profileId: string,
  type: string
): Promise<string> {
  const job = await prisma.listingSyncJob.create({
    data: { profileId, type, status: "pending" },
  });
  return job.id;
}

/** Update sync job status. */
export async function updateSyncJob(
  jobId: string,
  data: { status?: string; checkedCount?: number; fixedCount?: number; errorCount?: number; details?: string; errorMessage?: string; completedAt?: Date }
) {
  await prisma.listingSyncJob.update({ where: { id: jobId }, data });
}

/** Update profile denormalized listing stats. */
export async function refreshProfileStats(profileId: string): Promise<void> {
  const [total, live] = await Promise.all([
    prisma.businessListing.count({ where: { profileId } }),
    prisma.businessListing.count({
      where: { profileId, status: { in: ["live", "submitted", "claimed"] } },
    }),
  ]);
  await prisma.listSmartlyProfile.update({
    where: { id: profileId },
    data: { totalListings: total, liveListings: live },
  });
}
