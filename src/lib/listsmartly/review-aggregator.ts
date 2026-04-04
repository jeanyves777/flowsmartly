/**
 * Review aggregator for ListSmartly.
 * Handles manual import, deduplication, and batch AI sentiment analysis.
 */

import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";

interface ReviewImportInput {
  platform: string;
  authorName: string;
  rating: number;
  text?: string | null;
  publishedAt?: string | null;
  externalId?: string | null;
  reviewUrl?: string | null;
  authorAvatarUrl?: string | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
}

/**
 * Import an array of reviews, deduplicating by profileId + platform + externalId.
 */
export async function importReviews(
  profileId: string,
  reviews: ReviewImportInput[]
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const review of reviews) {
    if (!review.platform || !review.authorName || review.rating === undefined) {
      skipped++;
      continue;
    }

    const dedupeId = review.externalId || `manual_${review.authorName}_${review.rating}_${review.publishedAt || ""}`;

    try {
      const existing = await prisma.listingReview.findUnique({
        where: {
          profileId_platform_externalId: {
            profileId,
            platform: review.platform,
            externalId: dedupeId,
          },
        },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      await prisma.listingReview.create({
        data: {
          profileId,
          platform: review.platform,
          externalId: dedupeId,
          authorName: review.authorName,
          rating: parseInt(String(review.rating), 10),
          text: review.text || null,
          reviewUrl: review.reviewUrl || null,
          authorAvatarUrl: review.authorAvatarUrl || null,
          publishedAt: review.publishedAt ? new Date(review.publishedAt) : null,
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  // Refresh profile review stats
  await refreshReviewStats(profileId);

  return { imported, skipped, duplicates };
}

/**
 * Run batch sentiment analysis on reviews that lack sentiment data.
 * Processes reviews in chunks to avoid context limits.
 */
export async function analyzeSentimentBatch(
  profileId: string,
  limit = 50
): Promise<{ analyzed: number; failed: number }> {
  const reviews = await prisma.listingReview.findMany({
    where: {
      profileId,
      sentiment: null,
      text: { not: null },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  if (reviews.length === 0) return { analyzed: 0, failed: 0 };

  // Chunk reviews for AI processing (max 10 per call)
  const chunkSize = 10;
  let analyzed = 0;
  let failed = 0;

  for (let i = 0; i < reviews.length; i += chunkSize) {
    const chunk = reviews.slice(i, i + chunkSize);

    const reviewList = chunk.map((r, idx) => `[${idx}] Rating: ${r.rating}/5 | Text: "${r.text}"`).join("\n");

    const prompt = `Analyze the sentiment of these customer reviews:

${reviewList}

For each review, determine:
- sentiment: "positive" | "neutral" | "negative"
- sentimentScore: 0.0 to 1.0 (0 = very negative, 0.5 = neutral, 1.0 = very positive)
- keywords: array of 2-5 key themes/topics mentioned (e.g. ["fast service", "good food", "parking issue"])

Return JSON: { "results": [{ "index": 0, "sentiment": "...", "sentimentScore": 0.8, "keywords": [...] }, ...] }`;

    try {
      const result = await ai.generateJSON<{
        results: Array<{
          index: number;
          sentiment: string;
          sentimentScore: number;
          keywords: string[];
        }>;
      }>(prompt, {
        systemPrompt: SYSTEM_PROMPTS.reviewResponder,
        maxTokens: 1024,
      });

      if (result?.results) {
        for (const item of result.results) {
          const review = chunk[item.index];
          if (!review) continue;

          try {
            await prisma.listingReview.update({
              where: { id: review.id },
              data: {
                sentiment: item.sentiment,
                sentimentScore: item.sentimentScore,
                keywords: JSON.stringify(item.keywords || []),
              },
            });
            analyzed++;
          } catch {
            failed++;
          }
        }
      }
    } catch (error) {
      console.error("[ListSmartly] Sentiment batch analysis failed:", error);
      failed += chunk.length;
    }
  }

  return { analyzed, failed };
}

/**
 * Refresh the denormalized review stats on the profile.
 */
async function refreshReviewStats(profileId: string): Promise<void> {
  const stats = await prisma.listingReview.aggregate({
    where: { profileId },
    _count: true,
    _avg: { rating: true },
  });

  await prisma.listSmartlyProfile.update({
    where: { id: profileId },
    data: {
      totalReviews: stats._count,
      averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
    },
  });
}
