import { checkBannedWords } from "./banned-words";
import { prisma } from "@/lib/db/client";

const AUTO_FLAG_THRESHOLD = 3;
const AUTO_REMOVE_THRESHOLD = 5;

export interface ScreeningResult {
  action: "clean" | "flag" | "remove";
  reason?: string;
  matchedWords?: string[];
}

export async function screenContent(
  text: string,
  options: { useAI?: boolean } = {}
): Promise<ScreeningResult> {
  // 1. Keyword screening
  const wordCheck = checkBannedWords(text);
  if (wordCheck.hasSevereWords) {
    return { action: "remove", reason: "Contains prohibited content", matchedWords: wordCheck.matchedWords };
  }
  if (wordCheck.hasBannedWords) {
    return { action: "flag", reason: "Contains potentially inappropriate language", matchedWords: wordCheck.matchedWords };
  }

  // 2. Optional OpenAI Moderation API (free, no credits)
  if (options.useAI && process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const moderation = await client.moderations.create({ input: text });
      const result = moderation.results[0];
      if (result.flagged) {
        const flaggedCategories = Object.entries(result.categories)
          .filter(([, v]) => v)
          .map(([k]) => k);
        const hasHighSeverity = Object.entries(result.category_scores)
          .some(([cat, score]) => result.categories[cat as keyof typeof result.categories] && (score as number) > 0.8);
        return {
          action: hasHighSeverity ? "remove" : "flag",
          reason: `AI flagged: ${flaggedCategories.join(", ")}`,
        };
      }
    } catch (err) {
      console.error("OpenAI moderation check failed:", err);
    }
  }

  return { action: "clean" };
}

export async function processFlag(
  contentType: "post" | "comment",
  contentId: string
): Promise<void> {
  if (contentType === "post") {
    const post = await prisma.post.update({
      where: { id: contentId },
      data: { flagCount: { increment: 1 } },
      select: { flagCount: true },
    });
    if (post.flagCount >= AUTO_REMOVE_THRESHOLD) {
      await prisma.post.update({
        where: { id: contentId },
        data: { moderationStatus: "removed", moderationReason: "Auto-removed: exceeded flag threshold" },
      });
    } else if (post.flagCount >= AUTO_FLAG_THRESHOLD) {
      await prisma.post.update({
        where: { id: contentId },
        data: { moderationStatus: "flagged", moderationReason: "Auto-flagged: multiple user reports" },
      });
    }
  } else {
    const comment = await prisma.comment.update({
      where: { id: contentId },
      data: { flagCount: { increment: 1 } },
      select: { flagCount: true },
    });
    if (comment.flagCount >= AUTO_REMOVE_THRESHOLD) {
      await prisma.comment.update({
        where: { id: contentId },
        data: { moderationStatus: "removed", moderationReason: "Auto-removed: exceeded flag threshold" },
      });
    } else if (comment.flagCount >= AUTO_FLAG_THRESHOLD) {
      await prisma.comment.update({
        where: { id: contentId },
        data: { moderationStatus: "flagged", moderationReason: "Auto-flagged: multiple user reports" },
      });
    }
  }
}
