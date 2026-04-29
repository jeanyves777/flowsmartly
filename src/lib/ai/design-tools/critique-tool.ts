/**
 * Design critique tool — independent Claude vision review of an
 * in-progress design against the brief. Used by engine agents to
 * self-correct between iterations.
 *
 * Invariants:
 *  - Read-only. Never mutates the design.
 *  - Returns structured feedback the producing agent can act on:
 *    what's working, what's missing, concrete actionable suggestions.
 *  - Always shrinks the image under the 5 MB Claude vision cap so the
 *    call doesn't fail silently the way reproduceTemplate did before.
 */

import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { ImageStore } from "./image-store";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VISION_MAX_BYTES = 4_800_000;

async function shrinkForVision(buf: Buffer): Promise<{ b64: string; mediaType: "image/jpeg" | "image/png" }> {
  if (buf.length <= VISION_MAX_BYTES) {
    return { b64: buf.toString("base64"), mediaType: "image/png" };
  }
  const meta = await sharp(buf).metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);
  const target = Math.min(2048, longest);
  const resized = await sharp(buf)
    .resize(longest > target ? target : undefined, longest > target ? target : undefined, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return { b64: resized.toString("base64"), mediaType: "image/jpeg" };
}

export interface CritiqueResult {
  /** "ship" | "iterate" — agent should call finalize on "ship", call edit/regen on "iterate". */
  verdict: "ship" | "iterate";
  /** 1-10 quality score the agent can compare across iterations. */
  score: number;
  /** What's already working — keep these. */
  strengths: string[];
  /** What's missing or weak — fix these. */
  weaknesses: string[];
  /** Concrete, actionable suggestions ranked by impact. */
  suggestions: string[];
  /** Raw text from the model — kept for telemetry / debugging. */
  raw: string;
}

const CRITIQUE_SYSTEM = `You are a senior creative director reviewing an in-progress design produced by another agent. Your job is candid, actionable feedback — not a pat on the back.

Score the design 1-10 and decide whether to ship or iterate. Be honest:
- 9-10: ship. Truly polished, agency-quality work.
- 7-8: iterate ONCE more if the suggested fixes are quick wins; otherwise ship.
- 1-6: iterate. List concrete next moves.

Respond as STRICT JSON only — no prose, no markdown fences:
{
  "verdict": "ship" | "iterate",
  "score": <1-10>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "suggestions": ["high-impact fix one", "fix two", "fix three"]
}

Look for: typographic hierarchy (does the headline dominate?), text-to-photo collision (any words behind the subject?), color discipline (≤3 colors, on-brand?), iconography on contact info, decorative accents, alignment grid, edge margins, subject integration (does the cutout look pasted or grounded?), copy accuracy (does the design use the exact words from the brief or hallucinate?). Don't be vague — say "headline is too small relative to body" not "improve hierarchy".`;

/**
 * Ask Claude to critique a stored image against the brief. Returns
 * structured feedback the engine agent can route on (verdict, score,
 * suggestions).
 */
export async function critiqueDesign(
  store: ImageStore,
  args: { image_id: string; brief: string },
): Promise<CritiqueResult> {
  const src = store.get(args.image_id);
  const { b64, mediaType } = await shrinkForVision(src.buffer);

  const response = (await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    system: CRITIQUE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          {
            type: "text",
            text: `Brief the design must serve:\n\n${args.brief}\n\nReview the attached design against the brief and return your verdict as JSON.`,
          },
        ],
      },
    ],
    // SDK 0.32 typings don't include `thinking`; runtime accepts it.
  } as unknown as Parameters<typeof anthropic.messages.create>[0])) as Anthropic.Message;

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";

  // Parse the first {...} block. Default to "iterate" with a low score
  // when parsing fails so the agent doesn't accidentally ship a bad result.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      verdict: "iterate",
      score: 5,
      strengths: [],
      weaknesses: ["Critique returned no parseable JSON"],
      suggestions: ["Retry the critique call"],
      raw,
    };
  }
  try {
    const parsed = JSON.parse(match[0]) as Partial<CritiqueResult>;
    return {
      verdict: parsed.verdict === "ship" ? "ship" : "iterate",
      score: typeof parsed.score === "number" ? Math.max(1, Math.min(10, parsed.score)) : 5,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 6) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 6) : [],
      raw,
    };
  } catch {
    return {
      verdict: "iterate",
      score: 5,
      strengths: [],
      weaknesses: ["Critique JSON parse failed"],
      suggestions: ["Retry the critique call"],
      raw,
    };
  }
}
