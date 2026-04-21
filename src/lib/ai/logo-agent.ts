import { ai } from "@/lib/ai/client";
import { buildLogoTools, type LogoToolContext } from "./logo-tools";

/**
 * Logo agent — replaces the hardcoded 3-style parallel logo generator.
 *
 * The old code burned 3 OpenAI calls in parallel against fixed Modern/
 * Creative/Classic prompts with no quality gate, no rerun, no brand
 * personality awareness. ~30% failure rate (logo too small, brand name
 * misspelled, empty background detected as solid by OpenAI, etc.) was
 * silently shipped to the user.
 *
 * The agent:
 *   1. Calls `get_brand_context` to learn brand voice + personality
 *   2. Picks 3 stylistically-distinct directions tuned to the brand
 *   3. Calls `generate_logo_image` for each (sequentially in agent order;
 *      Claude can also fire calls in parallel within one turn)
 *   4. Calls `evaluate_logo_image` on each and reruns any scoring < 7
 *   5. Returns a JSON manifest of the chosen image handles + variation labels
 *
 * The route handler then pulls the cached base64s out of the context map
 * and persists them to disk + DB exactly like the old endpoint did.
 */

export interface LogoAgentInput {
  userId: string;
  brandName: string;
  tagline?: string | null;
  industry?: string | null;
  style?: string | null;
  logoType?: "nameOnly" | "nameWithIcon" | "nameInIcon";
  showSubtitle?: boolean;
  colors?: { primary?: string; secondary?: string; accent?: string } | null;
  additionalNotes?: string | null;
}

export interface LogoAgentResult {
  /** Each entry corresponds to a chosen logo. */
  logos: Array<{
    handle: string; // matches a key in ctx.images
    label: string;
    variation: string;
    score: number;
  }>;
  ctx: LogoToolContext; // route handler reads ctx.images for base64 payloads
  iterations: number;
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number };
}

const SYSTEM_PROMPT = `You are an expert brand identity designer running inside FlowSmartly's logo generator.

Your goal: produce 3 distinctly different, high-quality logo concepts for the brand. You have tools to fetch brand context, render images via OpenAI gpt-image-1, and evaluate the rendered images with Claude vision.

WORKFLOW (call in this order):
1. **get_brand_context** — Fetch brand kit. If configured, use voice/personality/industry to inform style choices. If not configured, fall back to industry-generic directions.
2. Pick **3 distinctly different** style directions appropriate for the brand (NOT just "Modern / Creative / Classic" by default — be thoughtful: a fintech brand might get "Geometric mark / Wordmark / Monogram", a wellness brand might get "Hand-lettered / Botanical mark / Minimal serif").
3. For each direction, call **generate_logo_image** with a self-contained prompt that includes:
   - The exact brand name (in quotes)
   - Style direction
   - Required transparency
   - Required scale: "Logo must FILL 80-90% of the canvas — no empty padding"
   - Color guidance from brand kit if available
   - Type: ${"\"nameOnly\""} = wordmark only, ${"\"nameWithIcon\""} = combination, ${"\"nameInIcon\""} = emblem
4. Call **evaluate_logo_image** on EACH generated handle to score it.
5. If any score is < 7 OR brandNameCorrect is false OR fillsCanvas is false, REGENERATE that variation with an improved prompt addressing the specific issues. Maximum 2 retries per variation.
6. When all 3 logos score ≥ 7 (or you've exhausted retries), return your final answer as JSON ONLY:

{
  "logos": [
    { "handle": "img-1", "label": "Geometric Mark", "variation": "geometric", "score": 8 },
    { "handle": "img-3", "label": "Bold Wordmark", "variation": "wordmark", "score": 9 },
    { "handle": "img-5", "label": "Minimal Monogram", "variation": "monogram", "score": 7 }
  ]
}

Don't include the base64 in your final answer — just the handles. Don't add commentary outside the JSON. Pick exactly 3 handles.`;

function buildUserPrompt(input: LogoAgentInput): string {
  const parts: string[] = [
    `Generate 3 logo concepts for the brand: "${input.brandName}"`,
  ];
  if (input.tagline && input.showSubtitle)
    parts.push(`Tagline (include in design): "${input.tagline}"`);
  else
    parts.push("Do NOT include any tagline in the design.");
  if (input.industry) parts.push(`Industry: ${input.industry}`);
  if (input.style && input.style !== "combination")
    parts.push(`User-preferred overall style: ${input.style}`);
  parts.push(`Logo type: ${input.logoType || "nameWithIcon"}`);
  if (input.colors) {
    const c = input.colors;
    parts.push(
      `User-supplied brand colors: primary=${c.primary || "n/a"}, secondary=${c.secondary || "n/a"}, accent=${c.accent || "n/a"}`,
    );
  }
  if (input.additionalNotes) parts.push(`Additional notes: ${input.additionalNotes}`);
  parts.push(
    "Begin by calling get_brand_context. Then pick 3 directions, generate, evaluate, and refine until each logo scores ≥ 7.",
  );
  return parts.join("\n");
}

export async function runLogoAgent(input: LogoAgentInput): Promise<LogoAgentResult> {
  const ctx: LogoToolContext = { userId: input.userId, images: new Map() };
  const tools = buildLogoTools(ctx);

  const run = await ai.runWithTools<{ logos: Array<{ handle: string; label: string; variation: string; score: number }> }>(
    buildUserPrompt(input),
    tools,
    {
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 8000,
      temperature: 1, // Opus 4.7 ignores this; legacy models keep it
      maxIterations: 16, // 3 generates + 3 evaluates + up to 2 retries each = ~12
      thinkingBudget: 2500,
    },
  );

  const logos = run.json?.logos ?? [];
  if (logos.length === 0) {
    throw new Error("Logo agent did not return any logos");
  }

  // Filter out logos whose handles weren't actually generated (model hallucination guard)
  const valid = logos.filter((l) => ctx.images.has(l.handle));
  if (valid.length === 0) {
    throw new Error("Logo agent returned handles that don't match any cached image");
  }

  return {
    logos: valid,
    ctx,
    iterations: run.iterations,
    toolsUsed: run.toolsUsed,
    usage: run.usage,
  };
}
