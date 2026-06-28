import { prisma } from "@/lib/db/client";
import { recordChange } from "@/lib/listsmartly/bulk-operations";
import type { FlowAgentTool } from "../registry";

/**
 * update_business_listing — the agent manages a single directory listing on the
 * user's Reviews & local SEO surface FOR them: mark a directory as submitted /
 * live / claimed (e.g. "I just listed us on Yelp"), correct the NAP details
 * (business name, phone, website, address), or set the listing URL. Mirrors
 * PUT /api/listsmartly/listings/[id] with a recordChange audit trail, but the
 * agent identifies the directory by NAME instead of an id.
 *
 * Mutating + confirmed plan. Free — flipping a listing's status / fixing its
 * NAP is presence management, not AI work. Lands at /home/reviews.
 * [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const VALID_STATUSES = ["live", "submitted", "claimed", "verified", "needs_update", "missing", "unverified", "error"];

export const updateBusinessListing: FlowAgentTool = {
  name: "update_business_listing",
  description:
    "Update one of the user's directory listings on the Reviews & local SEO surface. Use to mark a directory as submitted/live/claimed (e.g. 'mark Yelp as submitted', 'we're now live on Google Business'), fix NAP details (business name, phone, website, address), or set the live listing URL. Identify the directory by NAME via `directory` (e.g. 'Yelp', 'Google Business Profile'). Pass only the fields that change. Requires local presence to be set up (use setup_local_presence first if not). Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      directory: { type: "string", description: "Directory NAME to update, e.g. 'Yelp', 'Google Business Profile', 'Facebook'. Required." },
      status: { type: "string", description: "New status: 'submitted' (we sent it), 'live'/'claimed'/'verified' (it's live), 'needs_update', or 'missing'. Optional." },
      listingUrl: { type: "string", description: "Public URL of the live listing on that directory. Optional." },
      businessName: { type: "string", description: "Corrected business name (NAP). Optional." },
      phone: { type: "string", description: "Corrected phone (NAP). Optional." },
      website: { type: "string", description: "Corrected website (NAP). Optional." },
      address: { type: "string", description: "Corrected address (NAP). Optional." },
      description: { type: "string", description: "Listing description for this directory. Optional." },
    },
    required: ["planId", "directory"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_LISTING",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const directoryQuery = clean(input.directory, 120);
      if (!directoryQuery) {
        return { ok: false, error_code: "missing_input", message: "Tell me which directory to update (e.g. 'Yelp')." };
      }

      const profile = await prisma.listSmartlyProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });
      if (!profile) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "The user hasn't set up local presence yet. Use setup_local_presence first, then update listings.",
        };
      }

      // Resolve the listing by directory name (SQLite LIKE is case-insensitive for ASCII).
      const listing = await prisma.businessListing.findFirst({
        where: {
          profileId: profile.id,
          directory: { name: { contains: directoryQuery }, isActive: true },
        },
        include: { directory: { select: { name: true } } },
        orderBy: { directory: { tier: "asc" } },
      });
      if (!listing) {
        return {
          ok: false,
          error_code: "not_found",
          message: `No directory matching "${directoryQuery}" in the user's catalog. Ask them to confirm the directory name, or run a scan on the Reviews surface.`,
        };
      }

      const updateData: Record<string, unknown> = {};
      const changes: { field: string; from: string | null; to: string | null }[] = [];
      const cur = listing as unknown as Record<string, unknown>;

      if (input.status !== undefined) {
        const status = clean(input.status, 30).toLowerCase();
        if (!VALID_STATUSES.includes(status)) {
          return { ok: false, error_code: "validation_failed", message: `Invalid status "${status}". Use one of: ${VALID_STATUSES.join(", ")}.` };
        }
        updateData.status = status;
        if (status === "submitted" && !listing.submittedAt) updateData.submittedAt = new Date();
        if (["claimed", "verified"].includes(status) && !listing.claimedAt) updateData.claimedAt = new Date();
        if (status === "verified" && !listing.verifiedAt) updateData.verifiedAt = new Date();
        changes.push({ field: "status", from: listing.status, to: status });
      }

      const textFields: [string, number][] = [
        ["listingUrl", 500], ["businessName", 200], ["phone", 50], ["website", 300],
        ["address", 300], ["description", 1000],
      ];
      for (const [field, max] of textFields) {
        if (input[field] !== undefined) {
          const val = clean(input[field], max) || null;
          updateData[field] = val;
          changes.push({ field, from: (cur[field] as string) ?? null, to: val });
        }
      }

      if (changes.length === 0) {
        return { ok: false, error_code: "missing_input", message: "Nothing to change — pass a status or a NAP field to update." };
      }

      updateData.lastUpdatedAt = new Date();
      const updated = await prisma.businessListing.update({ where: { id: listing.id }, data: updateData });

      // Audit each changed field.
      for (const c of changes) {
        if (String(c.from || "") !== String(c.to || "")) {
          await recordChange(listing.id, c.field, c.from, c.to, "agent", "agent_update");
        }
      }

      return {
        ok: true,
        data: {
          listingId: updated.id,
          directory: listing.directory.name,
          status: updated.status,
          link: "/home/reviews",
          summary: `Updated the ${listing.directory.name} listing (${changes.map((c) => c.field).join(", ")}). Confirm to the user in ONE short sentence.`,
        },
        resultRefType: "BusinessListing",
        resultRefId: updated.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to update listing" };
    }
  },
};
