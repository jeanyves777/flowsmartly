/**
 * Sync engine orchestrator for ListSmartly.
 * Creates and manages listing scan/sync jobs.
 */
import { prisma } from "@/lib/db/client";
import { checkConsistency } from "./consistency-checker";
import { seedDirectories } from "./directories";
import { importReviews } from "./review-aggregator";

const LIVE_LISTING_STATUSES = new Set(["live", "submitted", "claimed"]);

type BusinessSignalInput = {
  businessName: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

type DirectorySearchInput = {
  slug: string;
  name: string;
  url: string;
};

type SearchResultItem = {
  link: string;
  title?: string;
  snippet?: string;
};

/** Reconcile every active catalog directory into a profile without overwriting existing listing state. */
export async function reconcileListingCatalog(profileId: string): Promise<{ total: number; created: number }> {
  await seedDirectories();

  const [directories, existingListings] = await Promise.all([
    prisma.listingDirectory.findMany({
      where: { isActive: true },
      select: { id: true },
    }),
    prisma.businessListing.findMany({
      where: { profileId },
      select: { directoryId: true },
    }),
  ]);

  const existingDirectoryIds = new Set(existingListings.map((listing) => listing.directoryId));
  let created = 0;

  for (const directory of directories) {
    if (existingDirectoryIds.has(directory.id)) continue;

    await prisma.businessListing.create({
      data: {
        profileId,
        directoryId: directory.id,
        status: "unverified",
      },
    });
    created++;
  }

  await prisma.listSmartlyProfile.update({
    where: { id: profileId },
    data: { totalListings: directories.length },
  });

  return { total: directories.length, created };
}

/** Create listing records for all active catalog directories. */
export async function initializeListings(profileId: string, industry?: string): Promise<number> {
  void industry;
  const result = await reconcileListingCatalog(profileId);
  return result.total;
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
    if (
      result.isConsistent !== listing.isConsistent ||
      JSON.stringify(result.inconsistencies) !== listing.inconsistencies
    ) {
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
export async function createSyncJob(profileId: string, type: string): Promise<string> {
  const job = await prisma.listingSyncJob.create({
    data: { profileId, type, status: "pending" },
  });
  return job.id;
}

/** Update sync job status. */
export async function updateSyncJob(
  jobId: string,
  data: {
    status?: string;
    checkedCount?: number;
    fixedCount?: number;
    errorCount?: number;
    details?: string;
    errorMessage?: string;
    completedAt?: Date;
  }
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
 * Real web presence detection using Google Places API, business website crawl,
 * connected socials, Brand Kit handles, and optional Google Custom Search.
 *
 * A listing is "missing" only after a directory-specific search actually ran
 * and found no confident match. Unsearched rows remain "unverified" so the UI
 * does not show false negatives as confirmed missing.
 */
export async function detectExistingPresence(
  profileId: string
): Promise<{ detected: number; searched: number; unverified: number }> {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found");

  const listings = await prisma.businessListing.findMany({
    where: { profileId, status: { not: "error" } },
    include: { directory: { select: { id: true, slug: true, name: true, url: true, tier: true } } },
  });

  if (listings.length === 0) return { detected: 0, searched: 0, unverified: 0 };

  const apiKey = getGoogleApiKey();
  const searchCx = getGoogleSearchCx();
  if (!apiKey) {
    console.error("ListSmartly: No Google API key available for presence detection");
    const unverified = await markUnsearchedMissingAsUnverified(profileId);
    return { detected: 0, searched: 0, unverified };
  }

  const businessName = profile.businessName;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  let detected = 0;
  let searched = 0;

  const googleListing = listings.find((listing) => listing.directory.slug === "google-business");
  if (googleListing) {
    try {
      const searchQuery = `${businessName}${location ? ` ${location}` : ""}`;
      const textSearchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      textSearchUrl.searchParams.set("query", searchQuery);
      textSearchUrl.searchParams.set("key", apiKey);

      const searchRes = await fetch(textSearchUrl.toString(), { signal: AbortSignal.timeout(8000) });
      const searchData = (await searchRes.json()) as {
        results?: Array<{ place_id: string; name: string; formatted_address?: string }>;
        status: string;
      };
      searched++;

      if (searchData.status === "OK" && searchData.results?.length) {
        const bestPlace = searchData.results
          .map((result) => ({
            result,
            score: scoreBusinessMatch(profile, result.name, result.formatted_address || ""),
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (!bestPlace || bestPlace.score < 4) {
          await markListingMissing(googleListing.id, "google_places_api");
        } else {
          const placeId = bestPlace.result.place_id;
          const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

          if (await markListingLive(googleListing.id, mapsUrl, "google_places_api")) detected++;
          await enrichGoogleListing(profileId, googleListing.id, placeId, mapsUrl, apiKey);
        }
      } else {
        await markListingMissing(googleListing.id, "google_places_api");
      }
    } catch (err) {
      console.error("ListSmartly: Google Places check failed:", err);
    }
  }

  const discoveredSocials = await crawlWebsiteForSocialLinks(profile.website);

  const connectedAccounts = await prisma.socialAccount.findMany({
    where: { userId: profile.userId, isActive: true },
    select: { platform: true, platformUsername: true },
  });

  const platformToSlug: Record<string, string> = {
    facebook: "facebook",
    instagram: "instagram",
    twitter: "twitter-x",
    linkedin: "linkedin",
    youtube: "youtube",
    tiktok: "tiktok",
  };

  for (const account of connectedAccounts) {
    const basePlatform = account.platform.split("_")[0].toLowerCase();
    const slug = platformToSlug[basePlatform];
    if (!slug) continue;

    const listing = listings.find(
      (item) => item.directory.slug === slug && !LIVE_LISTING_STATUSES.has(item.status)
    );
    if (!listing) continue;

    const username = (account.platformUsername || "").replace(/^@/, "");
    if (!username) continue;

    const urlMap: Record<string, string> = {
      facebook: `https://facebook.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      "twitter-x": `https://x.com/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
      youtube: `https://youtube.com/@${username}`,
      tiktok: `https://tiktok.com/@${username}`,
    };

    const url = urlMap[slug];
    if (url && (await markListingLive(listing.id, url, `connected_account_${basePlatform}`))) {
      detected++;
    }
  }

  const brandKit = await prisma.brandKit.findFirst({
    where: { userId: profile.userId },
    select: { handles: true },
  });

  const handles: Record<string, string> = {};
  try {
    if (brandKit?.handles) Object.assign(handles, JSON.parse(brandKit.handles as string));
  } catch {
    // Non-JSON handle data should not break a scan.
  }

  const socialMapping: Record<string, string> = {
    facebook: "facebook",
    instagram: "instagram",
    twitter: "twitter-x",
    linkedin: "linkedin",
    youtube: "youtube",
    tiktok: "tiktok",
  };

  for (const [platform, slug] of Object.entries(socialMapping)) {
    const listing = listings.find((item) => item.directory.slug === slug);
    if (!listing || LIVE_LISTING_STATUSES.has(listing.status)) continue;

    if (discoveredSocials[slug]) {
      if (await markListingLive(listing.id, discoveredSocials[slug], `website_crawl_${platform}`)) {
        detected++;
      }
      continue;
    }

    const handle = handles[platform];
    if (!handle) continue;

    const cleanHandle = handle.replace(/^@/, "");
    const profileUrls: Record<string, string> = {
      facebook: cleanHandle.startsWith("http") ? cleanHandle : `https://facebook.com/${cleanHandle}`,
      instagram: cleanHandle.startsWith("http") ? cleanHandle : `https://instagram.com/${cleanHandle}`,
      "twitter-x": cleanHandle.startsWith("http") ? cleanHandle : `https://x.com/${cleanHandle}`,
      linkedin: cleanHandle.startsWith("http") ? cleanHandle : `https://linkedin.com/company/${cleanHandle}`,
      youtube: cleanHandle.startsWith("http") ? cleanHandle : `https://youtube.com/@${cleanHandle}`,
      tiktok: cleanHandle.startsWith("http") ? cleanHandle : `https://tiktok.com/@${cleanHandle}`,
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
      if (
        (res.ok || res.status === 302 || res.status === 301) &&
        (await markListingLive(listing.id, url, `verified_handle_${platform}`))
      ) {
        detected++;
      }
    } catch {
      // Leave it unverified for directory search or manual review.
    }
  }

  if (searchCx) {
    const remainingListings = await prisma.businessListing.findMany({
      where: { profileId, status: { in: ["missing", "unverified", "needs_update"] } },
      include: { directory: { select: { id: true, slug: true, name: true, url: true, tier: true } } },
    });

    const searchable = remainingListings.filter((listing) => Boolean(extractDomain(listing.directory.url)));
    const batchSize = 5;
    const delayMs = 1000;

    for (let i = 0; i < searchable.length; i += batchSize) {
      const batch = searchable.slice(i, i + batchSize);
      for (const listing of batch) {
        try {
          const match = await findDirectoryListingWithGoogleSearch(apiKey, searchCx, profile, listing.directory);
          searched++;

          if (match) {
            if (await markListingLive(listing.id, match.link, "google_custom_search")) detected++;
          } else {
            await markListingMissing(listing.id, "google_custom_search");
          }
        } catch (err) {
          console.error(`ListSmartly: directory search failed for ${listing.directory.slug}:`, err);
        }
      }
      if (i + batchSize < searchable.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  } else {
    await markUnsearchedMissingAsUnverified(profileId);
  }

  await refreshProfileStats(profileId);
  const unverified = await prisma.businessListing.count({ where: { profileId, status: "unverified" } });
  console.log(`ListSmartly: verified ${detected} existing listings for "${businessName}"`);

  return { detected, searched, unverified };
}

async function enrichGoogleListing(
  profileId: string,
  listingId: string,
  placeId: string,
  mapsUrl: string,
  apiKey: string
): Promise<void> {
  const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailUrl.searchParams.set("place_id", placeId);
  detailUrl.searchParams.set(
    "fields",
    "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,url,reviews,opening_hours,business_status"
  );
  detailUrl.searchParams.set("key", apiKey);

  const detailRes = await fetch(detailUrl.toString(), { signal: AbortSignal.timeout(8000) });
  const detailData = (await detailRes.json()) as { result?: Record<string, unknown>; status: string };

  if (detailData.status !== "OK" || !detailData.result) return;

  const result = detailData.result;
  const reviews =
    (result.reviews as Array<{
      rating: number;
      text: string;
      relative_time_description: string;
      author_name: string;
      author_url?: string;
      profile_photo_url?: string;
      time?: number;
    }>) || [];
  const hours = (result.opening_hours as { weekday_text?: string[]; open_now?: boolean }) || {};

  const recentReviews = reviews.slice(0, 3).map((review) => ({
    rating: review.rating,
    text: review.text,
    timeAgo: review.relative_time_description,
    author: review.author_name,
  }));

  await prisma.businessListing.update({
    where: { id: listingId },
    data: {
      listingUrl: (result.url as string) || mapsUrl,
      businessName: (result.name as string) || undefined,
      phone: (result.formatted_phone_number as string) || undefined,
      address: (result.formatted_address as string) || undefined,
      website: (result.website as string) || undefined,
      aiDescription: JSON.stringify({
        rating: result.rating,
        reviewCount: result.user_ratings_total,
        recentReviews,
        hours: hours.weekday_text || [],
        isOpenNow: hours.open_now,
        businessStatus: result.business_status,
      }),
    },
  });

  if (result.rating || result.user_ratings_total) {
    await prisma.listSmartlyProfile.update({
      where: { id: profileId },
      data: {
        averageRating: (result.rating as number) || 0,
        totalReviews: (result.user_ratings_total as number) || 0,
      },
    });
  }

  if (reviews.length > 0) {
    await importReviews(
      profileId,
      reviews.map((review) => ({
        platform: "google",
        authorName: review.author_name || "Google reviewer",
        rating: review.rating,
        text: review.text || null,
        reviewUrl: (result.url as string) || mapsUrl,
        authorAvatarUrl: review.profile_photo_url || null,
        externalId: `google_${placeId}_${review.author_name || "anonymous"}_${review.time || review.relative_time_description || review.rating}`,
        publishedAt: review.time ? new Date(review.time * 1000).toISOString() : null,
        sentiment: review.rating >= 4 ? "positive" : review.rating <= 2 ? "negative" : "neutral",
        sentimentScore: Math.max(0, Math.min(1, review.rating / 5)),
        keywords: [],
      }))
    );
  }
}

async function crawlWebsiteForSocialLinks(websiteUrl: string | null): Promise<Record<string, string>> {
  const discoveredSocials: Record<string, string> = {};
  if (!websiteUrl) return discoveredSocials;

  try {
    const fullUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
    const res = await fetch(fullUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowSmartlyBot/1.0)" },
    });
    if (!res.ok) return discoveredSocials;

    const html = await res.text();
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
        if (url && url.length < 200) discoveredSocials[slug] = url;
      }
    }

    console.log(`ListSmartly: crawled website, found ${Object.keys(discoveredSocials).length} social links`);
  } catch (err) {
    console.error("ListSmartly: website crawl failed:", err);
  }

  return discoveredSocials;
}

async function findDirectoryListingWithGoogleSearch(
  apiKey: string,
  searchCx: string,
  profile: BusinessSignalInput,
  directory: DirectorySearchInput
): Promise<SearchResultItem | null> {
  const domain = extractDomain(directory.url);
  const phone = normalizePhone(profile.phone);
  const websiteDomain = profile.website ? extractDomain(profile.website) : "";
  const queries = [
    `site:${domain} "${profile.businessName}"`,
    phone ? `site:${domain} "${phone}"` : "",
    websiteDomain ? `site:${domain} "${websiteDomain}"` : "",
    profile.address ? `site:${domain} "${profile.address}" "${profile.city || ""}"` : "",
  ].filter(Boolean);

  for (const query of queries) {
    const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("cx", searchCx);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("num", "5");

    const res = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) continue;

    const data = (await res.json()) as { items?: SearchResultItem[] };
    const scored = (data.items || [])
      .filter((item) => extractDomain(item.link).endsWith(domain))
      .map((item) => ({ item, score: scoreSearchResult(profile, item) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 5) return scored[0].item;
  }

  return null;
}

function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
}

function getGoogleSearchCx(): string | undefined {
  return (
    process.env.GOOGLE_SEARCH_CX ||
    process.env.GOOGLE_CSE_ID ||
    process.env.GOOGLE_CUSTOM_SEARCH_CX ||
    process.env.GOOGLE_SEARCH_ENGINE_ID
  );
}

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function scoreBusinessMatch(profile: BusinessSignalInput, name: string, addressOrSnippet: string): number {
  const haystack = normalizeText(`${name} ${addressOrSnippet}`);
  const normalizedName = normalizeText(profile.businessName);
  const nameTokens = normalizedName.split(" ").filter((token) => token.length > 2);
  let score = 0;

  if (normalizedName && haystack.includes(normalizedName)) score += 6;
  score += Math.min(4, nameTokens.filter((token) => haystack.includes(token)).length);

  const normalizedAddress = normalizeText(profile.address);
  if (normalizedAddress && haystack.includes(normalizedAddress)) score += 4;
  if (profile.city && haystack.includes(normalizeText(profile.city))) score += 1;
  if (profile.state && haystack.includes(normalizeText(profile.state))) score += 1;

  return score;
}

function scoreSearchResult(profile: BusinessSignalInput, item: SearchResultItem): number {
  const rawHaystack = `${item.title || ""} ${item.snippet || ""} ${item.link}`;
  const haystack = normalizeText(rawHaystack);
  const normalizedName = normalizeText(profile.businessName);
  const nameTokens = normalizedName.split(" ").filter((token) => token.length > 2);
  const phone = normalizePhone(profile.phone);
  const haystackDigits = normalizePhone(rawHaystack);
  let score = 0;

  if (normalizedName && haystack.includes(normalizedName)) score += 6;
  score += Math.min(4, nameTokens.filter((token) => haystack.includes(token)).length);
  if (phone && (haystackDigits.includes(phone) || haystackDigits.includes(phone.slice(-7)))) score += 5;
  if (profile.website && haystack.includes(normalizeText(extractDomain(profile.website)))) score += 4;
  if (profile.address && haystack.includes(normalizeText(profile.address))) score += 4;
  if (profile.city && haystack.includes(normalizeText(profile.city))) score += 1;
  if (profile.state && haystack.includes(normalizeText(profile.state))) score += 1;

  return score;
}

async function markUnsearchedMissingAsUnverified(profileId: string): Promise<number> {
  await prisma.businessListing.updateMany({
    where: {
      profileId,
      status: "missing",
      lastCheckedAt: null,
    },
    data: { status: "unverified" },
  });

  return prisma.businessListing.count({ where: { profileId, status: "unverified" } });
}

async function markListingMissing(listingId: string, source: string): Promise<void> {
  const listing = await prisma.businessListing.findUnique({
    where: { id: listingId },
    select: { status: true },
  });
  if (!listing || LIVE_LISTING_STATUSES.has(listing.status)) return;

  await prisma.businessListing.update({
    where: { id: listingId },
    data: {
      status: "missing",
      lastCheckedAt: new Date(),
    },
  });

  if (listing.status !== "missing") {
    await prisma.listingChange.create({
      data: {
        listingId,
        changeType: "web_scan",
        fieldChanged: "status",
        oldValue: listing.status,
        newValue: "missing",
        changedBy: `verified: ${source}`,
      },
    });
  }
}

/** Mark a listing as live with verified URL and audit trail. */
async function markListingLive(listingId: string, url: string, source: string): Promise<boolean> {
  const listing = await prisma.businessListing.findUnique({
    where: { id: listingId },
    select: { status: true },
  });
  const oldStatus = listing?.status || null;

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

  if (oldStatus !== "live") {
    await prisma.listingChange.create({
      data: {
        listingId,
        changeType: "web_scan",
        fieldChanged: "status",
        oldValue: oldStatus,
        newValue: "live",
        changedBy: `verified: ${source}`,
      },
    });
  }

  return oldStatus !== "live";
}

/** Extract domain from URL. */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}
