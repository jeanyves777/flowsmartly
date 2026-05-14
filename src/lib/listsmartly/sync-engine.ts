/**
 * Sync engine orchestrator for ListSmartly.
 * Creates and manages listing scan/sync jobs.
 */
import { prisma } from "@/lib/db/client";
import { checkConsistency } from "./consistency-checker";
import { seedDirectories } from "./directories";
import { importReviews } from "./review-aggregator";

const LIVE_LISTING_STATUSES = new Set(["live", "submitted", "claimed"]);
const WEB_SEARCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const PUBLIC_SEARCH_TIMEOUT_MS = 12000;
const PUBLIC_SEARCH_BATCH_SIZE = 4;
const PUBLIC_SEARCH_DELAY_MS = 750;

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
  source?: string;
};

type DirectorySearchResult = {
  searched: boolean;
  match: SearchResultItem | null;
  source?: string;
  error?: string;
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
    where: { profileId, status: { in: ["live", "submitted", "claimed"] }, directory: { isActive: true } },
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
    prisma.businessListing.count({ where: { profileId, directory: { isActive: true } } }),
    prisma.businessListing.count({
      where: { profileId, status: { in: ["live", "submitted", "claimed"] }, directory: { isActive: true } },
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
 * and found no confident match. If Google Custom Search is not configured, the
   * scan falls back to a low-rate public web search so rows do not stay in an
   * ambiguous holding state after the user pressed Run Scan.
 */
export async function detectExistingPresence(
  profileId: string
): Promise<{ detected: number; searched: number; unverified: number; missing: number; errors: number }> {
  const profile = await prisma.listSmartlyProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found");

  const listings = await prisma.businessListing.findMany({
    where: { profileId, status: { not: "error" }, directory: { isActive: true } },
    include: { directory: { select: { id: true, slug: true, name: true, url: true, tier: true } } },
  });

  if (listings.length === 0) return { detected: 0, searched: 0, unverified: 0, missing: 0, errors: 0 };

  const apiKey = getGoogleApiKey();
  const searchCx = getGoogleSearchCx();
  if (!apiKey) {
    console.warn("ListSmartly: No Google API key available; skipping Google Places and using public web search.");
  }

  const businessName = profile.businessName;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  let detected = 0;
  let searched = 0;

  const googleListing = listings.find((listing) => listing.directory.slug === "google-business");
  if (googleListing && apiKey) {
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

  const remainingListings = await prisma.businessListing.findMany({
    where: { profileId, status: { in: ["missing", "unverified", "needs_update"] }, directory: { isActive: true } },
    include: { directory: { select: { id: true, slug: true, name: true, url: true, tier: true } } },
    orderBy: [{ directory: { tier: "asc" } }, { directory: { name: "asc" } }],
  });

  const searchable = remainingListings.filter((listing) => Boolean(extractDomain(listing.directory.url)));
  let errors = 0;

  for (let i = 0; i < searchable.length; i += PUBLIC_SEARCH_BATCH_SIZE) {
    const batch = searchable.slice(i, i + PUBLIC_SEARCH_BATCH_SIZE);
    await Promise.all(
      batch.map(async (listing) => {
        try {
          const search = await findDirectoryListing(profile, listing.directory, {
            apiKey,
            searchCx,
          });

          if (search.searched) searched++;

          if (search.match) {
            if (await markListingLive(listing.id, search.match.link, search.match.source || "directory_public_search")) {
              detected++;
            }
          } else if (search.searched) {
            await markListingMissing(listing.id, search.source || "directory_public_search");
          } else {
            errors++;
            await markListingScanError(listing.id, search.error || "Directory search could not run.");
          }
        } catch (err) {
          errors++;
          const message = err instanceof Error ? err.message : "Directory search failed.";
          console.error(`ListSmartly: directory search failed for ${listing.directory.slug}:`, err);
          await markListingScanError(listing.id, message);
        }
      })
    );

    if (i + PUBLIC_SEARCH_BATCH_SIZE < searchable.length) {
      await new Promise((resolve) => setTimeout(resolve, PUBLIC_SEARCH_DELAY_MS));
    }
  }

  await refreshProfileStats(profileId);
  const [unverified, missing] = await Promise.all([
    prisma.businessListing.count({
      where: { profileId, status: "unverified", directory: { isActive: true } },
    }),
    prisma.businessListing.count({
      where: { profileId, status: "missing", directory: { isActive: true } },
    }),
  ]);
  console.log(`ListSmartly: verified ${detected} existing listings for "${businessName}"`);

  return { detected, searched, unverified, missing, errors };
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

async function findDirectoryListing(
  profile: BusinessSignalInput,
  directory: DirectorySearchInput,
  options: { apiKey?: string; searchCx?: string }
): Promise<DirectorySearchResult> {
  const domain = extractDomain(directory.url);
  if (!domain) {
    return { searched: false, match: null, error: "Directory does not have a searchable domain." };
  }

  if (options.apiKey && options.searchCx) {
    try {
      const cseMatch = await findDirectoryListingWithGoogleSearch(
        options.apiKey,
        options.searchCx,
        profile,
        directory
      );
      return {
        searched: true,
        match: cseMatch ? { ...cseMatch, source: "google_custom_search" } : null,
        source: "google_custom_search",
      };
    } catch (error) {
      console.error(`ListSmartly: Google Custom Search failed for ${directory.slug}; falling back to public search`, error);
    }
  }

  return findDirectoryListingWithPublicSearch(profile, directory);
}

async function findDirectoryListingWithPublicSearch(
  profile: BusinessSignalInput,
  directory: DirectorySearchInput
): Promise<DirectorySearchResult> {
  const domain = extractDomain(directory.url);
  const queries = buildDirectorySearchQueries(profile, domain);
  const candidates: SearchResultItem[] = [];
  let searched = false;
  let lastError: string | undefined;

  for (const query of queries) {
    try {
      const results = await searchYahooReader(query, domain);
      searched = true;
      candidates.push(...results);

      const best = candidates
        .map((item) => ({ item, score: scoreSearchResult(profile, item) }))
        .sort((a, b) => b.score - a.score)[0];

      if (best && best.score >= 5) {
        return { searched: true, match: { ...best.item, source: "yahoo_public_search" }, source: "yahoo_public_search" };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Public directory search failed.";
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    searched,
    match: null,
    source: "yahoo_public_search",
    error: searched ? undefined : lastError || "Public directory search did not return a usable response.",
  };
}

function buildDirectorySearchQueries(profile: BusinessSignalInput, domain: string): string[] {
  const location = [profile.city, profile.state].filter(Boolean).join(" ");
  const phone = normalizePhone(profile.phone);
  const websiteDomain = profile.website ? extractDomain(profile.website) : "";
  const queries = [
    `site:${domain} "${profile.businessName}" ${location}`.trim(),
    profile.address ? `site:${domain} "${profile.businessName}" "${profile.address}"` : "",
    phone ? `site:${domain} "${phone}"` : "",
    websiteDomain ? `site:${domain} "${websiteDomain}" "${profile.businessName}"` : "",
  ].filter(Boolean);

  return Array.from(new Set(queries));
}

async function searchYahooReader(query: string, targetDomain: string): Promise<SearchResultItem[]> {
  const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
  const readerUrl = `https://r.jina.ai/http://r.jina.ai/http://${yahooUrl}`;
  const res = await fetch(readerUrl, {
    signal: AbortSignal.timeout(PUBLIC_SEARCH_TIMEOUT_MS),
    headers: {
      "User-Agent": WEB_SEARCH_USER_AGENT,
      Accept: "text/plain",
    },
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Public search returned HTTP ${res.status}`);
  }
  if (/captcha|confirm you.?re a human|too many requests|access denied/i.test(body) && !/## Search Results/i.test(body)) {
    throw new Error("Public search provider asked for human validation.");
  }

  const resultBody = body.includes("## Search Results")
    ? body.slice(body.indexOf("## Search Results"))
    : body;
  const items: SearchResultItem[] = [];
  const linkPattern = /\]\((https?:\/\/[^)\s]+)\)/g;

  for (const match of resultBody.matchAll(linkPattern)) {
    const link = decodeHtml(match[1] || "").replace(/&amp;/g, "&");
    if (!link || isSearchChromeUrl(link)) continue;
    if (!domainMatches(link, targetDomain)) continue;

    const contextStart = Math.max(0, (match.index || 0) - 280);
    const contextEnd = Math.min(resultBody.length, (match.index || 0) + match[0].length + 500);
    const context = resultBody.slice(contextStart, contextEnd);
    const titleContext = resultBody.slice(Math.max(0, (match.index || 0) - 520), match.index || 0);
    const snippet = cleanResultText(context);
    const title = cleanResultText(titleContext.split(/\n/).slice(-3).join(" "));
    items.push({ link, title, snippet, source: "yahoo_public_search" });

    if (items.length >= 8) break;
  }

  return dedupeSearchResults(items);
}

function dedupeSearchResults(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.link.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanResultText(value: string): string {
  return decodeHtml(value)
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[|\]|\(|\)|#+|\*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isSearchChromeUrl(value: string): boolean {
  const domain = extractDomain(value);
  return (
    domain.endsWith("yahoo.com") ||
    domain.endsWith("bing.com") ||
    domain.endsWith("yimg.com") ||
    domain.endsWith("microsoft.com")
  );
}

function rootDomain(value: string): string {
  const parts = extractDomain(value)
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const tldPair = parts.slice(-2).join(".");
  if (/^(co|com|org|net|gov|ac)\.[a-z]{2}$/i.test(tldPair) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function domainMatches(url: string, targetDomain: string): boolean {
  const host = extractDomain(url);
  if (!host || !targetDomain) return false;
  return rootDomain(host) === rootDomain(targetDomain);
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
      directory: { isActive: true },
    },
    data: { status: "unverified" },
  });

  return prisma.businessListing.count({ where: { profileId, status: "unverified", directory: { isActive: true } } });
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

async function markListingScanError(listingId: string, reason: string): Promise<void> {
  const listing = await prisma.businessListing.findUnique({
    where: { id: listingId },
    select: { status: true },
  });
  if (!listing || LIVE_LISTING_STATUSES.has(listing.status)) return;

  await prisma.businessListing.update({
    where: { id: listingId },
    data: {
      status: "error",
      lastCheckedAt: new Date(),
    },
  });

  if (listing.status !== "error") {
    await prisma.listingChange.create({
      data: {
        listingId,
        changeType: "web_scan",
        fieldChanged: "status",
        oldValue: listing.status,
        newValue: "error",
        changedBy: `scan error: ${reason.slice(0, 120)}`,
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
