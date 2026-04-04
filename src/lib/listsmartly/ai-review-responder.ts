/**
 * AI-powered review response drafter for ListSmartly.
 * Uses Claude AI to generate on-brand responses to customer reviews.
 */

import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";

interface ReviewInput {
  text: string | null;
  rating: number;
  authorName: string;
}

interface BrandContext {
  businessName: string;
  voiceTone?: string;
  personality?: string;
  industry?: string;
}

interface ReviewResponseResult {
  response: string;
  tone: string;
}

/**
 * Draft an AI response to a customer review using brand voice.
 */
export async function draftReviewResponse(
  review: ReviewInput,
  brand: BrandContext
): Promise<ReviewResponseResult> {
  const sentiment = review.rating >= 4 ? "positive" : review.rating === 3 ? "neutral" : "negative";

  const prompt = `Draft a response to this customer review:

Reviewer: ${review.authorName}
Rating: ${review.rating}/5 (${sentiment})
Review Text: ${review.text || "(No text, rating only)"}

Brand Context:
- Business Name: ${brand.businessName}
- Industry: ${brand.industry || "General"}
- Voice/Tone: ${brand.voiceTone || "Professional and friendly"}
- Personality: ${brand.personality || "Approachable, helpful"}

Guidelines:
- For positive reviews (4-5 stars): Express genuine gratitude, reinforce specific compliments, invite them back.
- For neutral reviews (3 stars): Thank them, acknowledge any concerns, offer to improve.
- For negative reviews (1-2 stars): Acknowledge the issue, apologize sincerely, offer a resolution path (e.g. "please contact us at..."). Never be defensive.
- Address the reviewer by name.
- Keep the response between 50-150 words.
- Match the brand's voice and tone.

Return JSON: { "response": "...", "tone": "positive|empathetic|professional|apologetic" }`;

  const result = await ai.generateJSON<ReviewResponseResult>(prompt, {
    systemPrompt: SYSTEM_PROMPTS.reviewResponder,
    maxTokens: 512,
  });

  return {
    response: result?.response || `Thank you for your feedback, ${review.authorName}. We appreciate you taking the time to share your experience.`,
    tone: result?.tone || "professional",
  };
}
