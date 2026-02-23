import googleTrends from "google-trends-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrendDataPoint {
  date: string;
  value: number;
}

interface TrendResult {
  keyword: string;
  timelineData: TrendDataPoint[];
  averageInterest: number;
}

interface RelatedQuery {
  query: string;
  value: number;
}

interface DailyTrend {
  title: string;
  traffic: string;
}

// ---------------------------------------------------------------------------
// 15-minute in-memory cache
// ---------------------------------------------------------------------------

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

// ---------------------------------------------------------------------------
// searchTrends — interest-over-time data with timeline
// ---------------------------------------------------------------------------

export async function searchTrends(
  keyword: string,
  geo?: string
): Promise<TrendResult> {
  const cacheKey = `searchTrends:${keyword}:${geo || ""}`;
  const cached = getCached<TrendResult>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await googleTrends.interestOverTime({
      keyword,
      startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      geo,
    });

    const parsed = JSON.parse(raw);
    const timeline: TrendDataPoint[] = (
      parsed?.default?.timelineData ?? []
    ).map((point: { formattedAxisTime: string; value: number[] }) => ({
      date: point.formattedAxisTime,
      value: point.value?.[0] ?? 0,
    }));

    const averageInterest =
      timeline.length > 0
        ? Math.round(
            timeline.reduce((sum, p) => sum + p.value, 0) / timeline.length
          )
        : 0;

    const result: TrendResult = { keyword, timelineData: timeline, averageInterest };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`[trends] searchTrends failed for "${keyword}":`, error);
    return { keyword, timelineData: [], averageInterest: 0 };
  }
}

// ---------------------------------------------------------------------------
// getRelatedQueries — top + rising queries
// ---------------------------------------------------------------------------

export async function getRelatedQueries(
  keyword: string,
  geo?: string
): Promise<{ top: RelatedQuery[]; rising: RelatedQuery[] }> {
  const cacheKey = `relatedQueries:${keyword}:${geo || ""}`;
  const cached = getCached<{ top: RelatedQuery[]; rising: RelatedQuery[] }>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await googleTrends.relatedQueries({ keyword, geo });
    const parsed = JSON.parse(raw);

    const defaultData = parsed?.default?.rankedList ?? [];

    const top: RelatedQuery[] = (defaultData[0]?.rankedKeyword ?? []).map(
      (item: { query: string; value: number }) => ({
        query: item.query,
        value: item.value,
      })
    );

    const rising: RelatedQuery[] = (defaultData[1]?.rankedKeyword ?? []).map(
      (item: { query: string; value: number }) => ({
        query: item.query,
        value: item.value,
      })
    );

    const result = { top, rising };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`[trends] getRelatedQueries failed for "${keyword}":`, error);
    return { top: [], rising: [] };
  }
}

// ---------------------------------------------------------------------------
// getDailyTrends — daily trending searches
// ---------------------------------------------------------------------------

export async function getDailyTrends(
  geo?: string
): Promise<DailyTrend[]> {
  const resolvedGeo = geo || "US";
  const cacheKey = `dailyTrends:${resolvedGeo}`;
  const cached = getCached<DailyTrend[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await googleTrends.dailyTrends({ geo: resolvedGeo });
    const parsed = JSON.parse(raw);

    const days = parsed?.default?.trendingSearchesDays ?? [];
    const trends: DailyTrend[] = [];

    for (const day of days) {
      for (const search of day.trendingSearches ?? []) {
        trends.push({
          title: search.title?.query ?? "",
          traffic: search.formattedTraffic ?? "0",
        });
      }
    }

    setCache(cacheKey, trends);
    return trends;
  } catch (error) {
    console.error(`[trends] getDailyTrends failed for "${resolvedGeo}":`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// compareTrends — compare multiple keywords
// ---------------------------------------------------------------------------

export async function compareTrends(
  keywords: string[],
  geo?: string
): Promise<TrendResult[]> {
  const cacheKey = `compareTrends:${keywords.join(",")}:${geo || ""}`;
  const cached = getCached<TrendResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await googleTrends.interestOverTime({
      keyword: keywords,
      startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      geo,
    });

    const parsed = JSON.parse(raw);
    const timelineData = parsed?.default?.timelineData ?? [];

    const results: TrendResult[] = keywords.map((keyword, index) => {
      const timeline: TrendDataPoint[] = timelineData.map(
        (point: { formattedAxisTime: string; value: number[] }) => ({
          date: point.formattedAxisTime,
          value: point.value?.[index] ?? 0,
        })
      );

      const averageInterest =
        timeline.length > 0
          ? Math.round(
              timeline.reduce((sum, p) => sum + p.value, 0) / timeline.length
            )
          : 0;

      return { keyword, timelineData: timeline, averageInterest };
    });

    setCache(cacheKey, results);
    return results;
  } catch (error) {
    console.error(`[trends] compareTrends failed for "${keywords.join(", ")}":`, error);
    return keywords.map((keyword) => ({
      keyword,
      timelineData: [],
      averageInterest: 0,
    }));
  }
}

// ---------------------------------------------------------------------------
// getTrendingForIndustry — trending products for an industry
// ---------------------------------------------------------------------------

export async function getTrendingForIndustry(
  industry: string,
  geo?: string
): Promise<{ top: RelatedQuery[]; rising: RelatedQuery[] }> {
  const cacheKey = `trendingForIndustry:${industry}:${geo || ""}`;
  const cached = getCached<{ top: RelatedQuery[]; rising: RelatedQuery[] }>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await googleTrends.relatedQueries({ keyword: industry, geo });
    const parsed = JSON.parse(raw);

    const defaultData = parsed?.default?.rankedList ?? [];

    const top: RelatedQuery[] = (defaultData[0]?.rankedKeyword ?? []).map(
      (item: { query: string; value: number }) => ({
        query: item.query,
        value: item.value,
      })
    );

    const rising: RelatedQuery[] = (defaultData[1]?.rankedKeyword ?? []).map(
      (item: { query: string; value: number }) => ({
        query: item.query,
        value: item.value,
      })
    );

    const result = { top, rising };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(
      `[trends] getTrendingForIndustry failed for "${industry}":`,
      error
    );
    return { top: [], rising: [] };
  }
}
