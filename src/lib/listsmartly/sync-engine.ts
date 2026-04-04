/**
 * Sync engine orchestrator for ListSmartly.
 * Creates and manages listing scan/sync jobs.
 */
import { prisma } from "@/lib/db/client";
import { checkConsistency } from "./consistency-checker";
// Real web verification only — no guessing

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

/**
 * Real web presence detection using Google Places API + Google Search.
 * Same APIs used by the Pitch Board lead finder (src/lib/pitch/researcher.ts).
 * Only marks listings as "live" when verified with a real URL.
 */
export async function detectExistingPresence(profileId: string): Promise<{ detected: number }> {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found");

  const listings = await prisma.businessListing.findMany({
    where: { profileId, status: "missing" },
    include: { directory: { select: { id: true, slug: true, name: true, url: true, tier: true } } },
  });

  if (listings.length === 0) return { detected: 0 };

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("ListSmartly: No Google API key available for presence detection");
    return { detected: 0 };
  }

  const businessName = profile.businessName;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  let detected = 0;

  // ── Step 1: Verify Google Business Profile via Places API ──
  const googleListing = listings.find((l) => l.directory.slug === "google-business");
  if (googleListing) {
    try {
      const searchQuery = `${businessName}${location ? ` ${location}` : ""}`;
      const textSearchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      textSearchUrl.searchParams.set("query", searchQuery);
      textSearchUrl.searchParams.set("key", apiKey);

      const searchRes = await fetch(textSearchUrl.toString(), { signal: AbortSignal.timeout(8000) });
      const searchData = await searchRes.json() as { results: Array<{ place_id: string; name: string }>; status: string };

      if (searchData.status === "OK" && searchData.results?.length > 0) {
        const placeId = searchData.results[0].place_id;
        const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

        await markListingLive(googleListing.id, mapsUrl, "google_places_api");
        detected++;

        // Also fetch details to enrich the profile
        const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailUrl.searchParams.set("place_id", placeId);
        detailUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,url");
        detailUrl.searchParams.set("key", apiKey);

        const detailRes = await fetch(detailUrl.toString(), { signal: AbortSignal.timeout(8000) });
        const detailData = await detailRes.json() as { result: Record<string, unknown>; status: string };

        if (detailData.status === "OK" && detailData.result) {
          const r = detailData.result;
          // Update listing with verified data from Google
          await prisma.businessListing.update({
            where: { id: googleListing.id },
            data: {
              listingUrl: (r.url as string) || mapsUrl,
              businessName: r.name as string || undefined,
              phone: r.formatted_phone_number as string || undefined,
              address: r.formatted_address as string || undefined,
              website: r.website as string || undefined,
            },
          });
          // Store review data on profile
          if (r.rating || r.user_ratings_total) {
            await prisma.listSmartlyProfile.update({
              where: { id: profileId },
              data: {
                averageRating: (r.rating as number) || 0,
                totalReviews: (r.user_ratings_total as number) || 0,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("ListSmartly: Google Places check failed:", err);
    }
  }

  // ── Step 2: Check other directories via Google Search site: operator ──
  const otherListings = listings.filter(
    (l) => l.directory.slug !== "google-business" && l.directory.tier <= 3
  );

  // Batch search: combine multiple site: queries into one Google search
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000;

  for (let i = 0; i < otherListings.length; i += BATCH_SIZE) {
    const batch = otherListings.slice(i, i + BATCH_SIZE);

    for (const listing of batch) {
      try {
        const domain = extractDomain(listing.directory.url);
        const query = `site:${domain} "${businessName}"`;

        // Use Google Custom Search JSON API (uses GOOGLE_API_KEY)
        const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
        searchUrl.searchParams.set("key", apiKey);
        searchUrl.searchParams.set("cx", process.env.GOOGLE_SEARCH_CX || "");
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("num", "3");

        // If no CX, try Places text search as fallback for the directory name
        if (!process.env.GOOGLE_SEARCH_CX) {
          // Use Places text search to find business on the directory
          const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
          placesUrl.searchParams.set("query", `${businessName} ${domain}`);
          placesUrl.searchParams.set("key", apiKey);

          const placesRes = await fetch(placesUrl.toString(), { signal: AbortSignal.timeout(6000) });
          const placesData = await placesRes.json() as { results: Array<{ name: string; place_id: string }>; status: string };

          // This just confirms the business exists, doesn't prove it's on this directory
          // Skip — we can't verify directory-specific presence without Custom Search
          continue;
        }

        const res = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;

        const data = await res.json() as { items?: Array<{ link: string; title: string }>; searchInformation?: { totalResults: string } };

        if (data.items && data.items.length > 0) {
          const foundUrl = data.items[0].link;
          await markListingLive(listing.id, foundUrl, "google_custom_search");
          detected++;
        }
      } catch {
        // Skip this directory on error
      }
    }

    if (i + BATCH_SIZE < otherListings.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  await refreshProfileStats(profileId);
  console.log(`ListSmartly: verified ${detected} existing listings for "${businessName}"`);

  return { detected };
}

/** Mark a listing as live with verified URL and audit trail. */
async function markListingLive(listingId: string, url: string, source: string): Promise<void> {
  await prisma.businessListing.update({
    where: { id: listingId },
    data: {
      status: "live",
      listingUrl: url,
      isConsistent: true,
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });
  await prisma.listingChange.create({
    data: {
      listingId,
      changeType: "web_scan",
      fieldChanged: "status",
      oldValue: "missing",
      newValue: "live",
      changedBy: `verified: ${source}`,
    },
  });
}

/** Extract domain from URL. */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}
