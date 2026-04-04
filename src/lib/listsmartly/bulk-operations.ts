/**
 * Bulk update operations for ListSmartly.
 * Applies changes to multiple listings with audit trail.
 */
import { prisma } from "@/lib/db/client";

interface BulkUpdateInput {
  listingIds: string[];
  updates: Record<string, string | null>;
  changedBy: string; // "user" | "ai_autopilot" | "bulk_import"
}

export async function bulkUpdateListings(input: BulkUpdateInput): Promise<{ updated: number }> {
  const { listingIds, updates, changedBy } = input;
  let updated = 0;

  for (const listingId of listingIds) {
    const listing = await prisma.businessListing.findUnique({ where: { id: listingId } });
    if (!listing) continue;

    // Record changes
    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = (listing as Record<string, unknown>)[field];
      if (String(oldValue || "") !== String(newValue || "")) {
        await prisma.listingChange.create({
          data: {
            listingId,
            changeType: "bulk_update",
            fieldChanged: field,
            oldValue: String(oldValue || ""),
            newValue: newValue || "",
            changedBy,
          },
        });
      }
    }

    await prisma.businessListing.update({
      where: { id: listingId },
      data: { ...updates, lastUpdatedAt: new Date() },
    });
    updated++;
  }

  return { updated };
}

/** Record a single field change for audit trail. */
export async function recordChange(
  listingId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: string,
  changeType: string = "manual_update"
): Promise<void> {
  await prisma.listingChange.create({
    data: { listingId, changeType, fieldChanged: field, oldValue, newValue, changedBy },
  });
}
