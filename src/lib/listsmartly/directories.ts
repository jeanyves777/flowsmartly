/**
 * Directory registry helpers for ListSmartly.
 */
import { prisma } from "@/lib/db/client";
import { DIRECTORY_CATALOG } from "@/lib/constants/listsmartly";

/** Seed all directories from the catalog into the database. */
export async function seedDirectories(): Promise<number> {
  let count = 0;
  for (const dir of DIRECTORY_CATALOG) {
    await prisma.listingDirectory.upsert({
      where: { slug: dir.slug },
      update: {
        name: dir.name,
        url: dir.url,
        tier: dir.tier,
        category: dir.category,
        industries: JSON.stringify(dir.industries || []),
        submitUrl: dir.submitUrl || null,
        claimUrl: dir.claimUrl || null,
        apiAvailable: dir.apiAvailable || false,
      },
      create: {
        slug: dir.slug,
        name: dir.name,
        url: dir.url,
        tier: dir.tier,
        category: dir.category,
        industries: JSON.stringify(dir.industries || []),
        submitUrl: dir.submitUrl || null,
        claimUrl: dir.claimUrl || null,
        apiAvailable: dir.apiAvailable || false,
      },
    });
    count++;
  }
  return count;
}

/** Get directories relevant to a specific industry. */
export async function getDirectoriesForIndustry(industry: string): Promise<string[]> {
  const dirs = await prisma.listingDirectory.findMany({
    where: { isActive: true },
    select: { id: true, industries: true },
  });
  return dirs
    .filter((d) => {
      const industries: string[] = JSON.parse(d.industries || "[]");
      return industries.length === 0 || industries.includes(industry.toLowerCase());
    })
    .map((d) => d.id);
}

/** Get a single directory by slug. */
export async function getDirectoryBySlug(slug: string) {
  return prisma.listingDirectory.findUnique({ where: { slug } });
}
