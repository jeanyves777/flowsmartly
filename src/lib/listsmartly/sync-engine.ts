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
        detailUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,url,reviews,opening_hours,business_status");
        detailUrl.searchParams.set("key", apiKey);

        const detailRes = await fetch(detailUrl.toString(), { signal: AbortSignal.timeout(8000) });
        const detailData = await detailRes.json() as { result: Record<string, unknown>; status: string };

        if (detailData.status === "OK" && detailData.result) {
          const r = detailData.result;
          // Extract reviews and hours
          const reviews = (r.reviews as Array<{ rating: number; text: string; relative_time_description: string; author_name: string }>) || [];
          const hours = (r.opening_hours as { weekday_text?: string[]; open_now?: boolean }) || {};
          const isOpenNow = hours.open_now;

          // Store rich data: reviews in aiDescription (JSON), hours in description
          const recentReviews = reviews.slice(0, 3).map(rv => ({
            rating: rv.rating,
            text: rv.text,
            timeAgo: rv.relative_time_description,
            author: rv.author_name,
          }));

          await prisma.businessListing.update({
            where: { id: googleListing.id },
            data: {
              listingUrl: (r.url as string) || mapsUrl,
              businessName: r.name as string || undefined,
              phone: r.formatted_phone_number as string || undefined,
              address: r.formatted_address as string || undefined,
              website: r.website as string || undefined,
              // Store rich Google data as JSON
              aiDescription: JSON.stringify({
                rating: r.rating,
                reviewCount: r.user_ratings_total,
                recentReviews,
                hours: hours.weekday_text || [],
                isOpenNow,
                businessStatus: r.business_status,
              }),
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

  // ── Step 2: Crawl business website for social links ──
  // Reuses the same technique as Pitch Board researcher (extractSocialLinks)
  const websiteUrl = profile.website;
  const discoveredSocials: Record<string, string> = {}; // slug → URL

  if (websiteUrl) {
    try {
      const fullUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
      const res = await fetch(fullUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowSmartlyBot/1.0)" },
      });
      if (res.ok) {
        const html = await res.text();

        // Extract social links using same regex as pitch board researcher.ts
        const socialPatterns: Array<{ slug: string; pattern: RegExp }> = [
          { slug: "facebook", pattern: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/(?!share|sharer|tr\?|login)[^"'\s?#]+)/gi },
          { slug: "instagram", pattern: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s?#/][^"'\s?#]*)/gi },
          { slug: "twitter-x", pattern: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share)[^"'\s?#/][^"'\s?#]*)/gi },
          { slug: "linkedin", pattern: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s?#]*)/gi },
          { slug: "youtube", pattern: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/@?[^"'\s?#/][^"'\s?#]*)/gi },
          { slug: "tiktok", pattern: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s?#]*)/gi },
          { slug: "pinterest", pattern: /href=["'](https?:\/\/(?:www\.)?pinterest\.com\/[^"'\s?#/][^"'\s?#]*)/gi },
        ];

        for (const { slug, pattern } of socialPatterns) {
          const matches = [...html.matchAll(pattern)];
          if (matches.length > 0) {
            const url = matches[0][1]?.split(/['"]/)[0];
            if (url && url.length < 200) {
              discoveredSocials[slug] = url;
            }
          }
        }
        console.log(`ListSmartly: crawled website, found ${Object.keys(discoveredSocials).length} social links`);
      }
    } catch (err) {
      console.error("ListSmartly: website crawl failed:", err);
    }
  }

  // ── Step 3: Check social media — website crawl + BrandKit handles ──
  const brandKit = await prisma.brandKit.findFirst({
    where: { userId: profile.userId },
    select: { handles: true },
  });

  const handles: Record<string, string> = {};
  try {
    if (brandKit?.handles) Object.assign(handles, JSON.parse(brandKit.handles as string));
  } catch { /* not JSON */ }

  // Merge: website-discovered links take priority (real verified URLs),
  // then BrandKit handles as fallback
  const socialMapping: Record<string, string> = {
    facebook: "facebook",
    instagram: "instagram",
    twitter: "twitter-x",
    linkedin: "linkedin",
    youtube: "youtube",
    tiktok: "tiktok",
  };

  for (const [platform, slug] of Object.entries(socialMapping)) {
    const listing = listings.find((l) => l.directory.slug === slug);
    if (!listing || listing.status !== "missing") continue;

    // Priority 1: URL discovered from website crawl (real verified link)
    if (discoveredSocials[slug]) {
      await markListingLive(listing.id, discoveredSocials[slug], `website_crawl_${platform}`);
      detected++;
      continue;
    }

    // Priority 2: BrandKit handle — build URL and verify with HEAD request
    const handle = handles[platform];
    if (!handle) continue;

    const profileUrls: Record<string, string> = {
      facebook: `https://facebook.com/${handle}`,
      instagram: `https://instagram.com/${handle}`,
      "twitter-x": `https://x.com/${handle}`,
      linkedin: handle.startsWith("http") ? handle : `https://linkedin.com/company/${handle}`,
      youtube: handle.startsWith("http") ? handle : `https://youtube.com/@${handle}`,
      tiktok: `https://tiktok.com/@${handle}`,
    };

    const url = profileUrls[slug];
    if (!url) continue;

    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowSmartlyBot/1.0)" },
      });
      if (res.ok || res.status === 302 || res.status === 301) {
        await markListingLive(listing.id, url, `verified_handle_${platform}`);
        detected++;
      }
    } catch {
      // HEAD failed — do NOT mark as live, leave as "missing"
      // User can manually verify and update later
    }
  }

  // ── Step 4: Google Custom Search for remaining directories (if CX is set) ──
  if (process.env.GOOGLE_SEARCH_CX) {
    const remainingListings = await prisma.businessListing.findMany({
      where: { profileId, status: "missing" },
      include: { directory: { select: { id: true, slug: true, url: true, tier: true } } },
    });
    const searchable = remainingListings.filter((l) => l.directory.tier <= 2);

    const BATCH_SIZE = 5;
    const DELAY_MS = 1000;

    for (let i = 0; i < searchable.length; i += BATCH_SIZE) {
      const batch = searchable.slice(i, i + BATCH_SIZE);
      for (const listing of batch) {
        try {
          const domain = extractDomain(listing.directory.url);
          const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
          searchUrl.searchParams.set("key", apiKey);
          searchUrl.searchParams.set("cx", process.env.GOOGLE_SEARCH_CX!);
          searchUrl.searchParams.set("q", `site:${domain} "${businessName}"`);
          searchUrl.searchParams.set("num", "3");

          const res = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;
          const data = await res.json() as { items?: Array<{ link: string }> };
          if (data.items?.length) {
            await markListingLive(listing.id, data.items[0].link, "google_custom_search");
            detected++;
          }
        } catch { /* skip */ }
      }
      if (i + BATCH_SIZE < searchable.length) await new Promise((r) => setTimeout(r, DELAY_MS));
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
