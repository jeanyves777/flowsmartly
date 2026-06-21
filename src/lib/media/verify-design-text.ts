import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

/**
 * verifyDesignText — a cheap Claude vision QA pass that proofreads the RENDERED
 * text in a generated design against the brand's EXACT values. Image models
 * garble long exact strings (emails/URLs/phones) and sometimes duplicate the
 * headline; this catches it so the agent can auto-run the xAI corrective edit.
 *
 * Mirrors analyze-logo-placement.ts (Haiku vision, strict JSON, never throws).
 */

const VISION_MODEL = process.env.FLOWCREATIVE_VISION_MODEL || "claude-haiku-4-5";
const VISION_MAX_BYTES = 4_800_000;

const primaryAnthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const backupAnthropic = process.env.ANTHROPIC_BACKUP_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY }) : null;

export interface DesignTextExpectations {
  brandName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
}

export interface DesignTextIssue {
  field: string; // "email" | "phone" | "website" | "address" | "headline" | ...
  expected: string;
  found: string;
}

export interface DesignTextVerdict {
  ok: boolean;
  contactIssues: DesignTextIssue[];
  headlineDuplicated: boolean;
  /** The design is rendered as a card/panel/flyer floating on a separate background (nesting). */
  cardOnSurface: boolean;
  /** Body/headline text contains gibberish / misspelled non-words the model garbled. */
  garbledText: boolean;
  /** "vision" if Claude judged it, "skipped" if vision unavailable / nothing to check. */
  source: "vision" | "skipped";
  summary?: string;
}

async function shrinkForVision(buffer: Buffer): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  let working = buffer;
  if (working.length > VISION_MAX_BYTES) {
    working = await sharp(buffer).resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } else {
    working = await sharp(buffer).resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  }
  return { base64: working.toString("base64"), mediaType: "image/jpeg" };
}

/**
 * Proofread a design's text. Returns ok=true (nothing to fix) when there are no
 * expected values, vision is unavailable, or the render matches. Never throws.
 */
export async function verifyDesignText(
  imageBuffer: Buffer,
  expected: DesignTextExpectations,
  options: { checkDesignQuality?: boolean } = {},
): Promise<DesignTextVerdict> {
  const clean: DesignTextVerdict = {
    ok: true, contactIssues: [], headlineDuplicated: false,
    cardOnSurface: false, garbledText: false, source: "skipped",
  };
  const expectedLines = [
    expected.brandName ? `Brand name: ${expected.brandName}` : null,
    expected.phone ? `Phone: ${expected.phone}` : null,
    expected.email ? `Email: ${expected.email}` : null,
    expected.website ? `Website: ${expected.website}` : null,
    expected.address ? `Address: ${expected.address}` : null,
  ].filter(Boolean) as string[];

  // Run the vision call when there are exact strings to proofread OR the caller
  // wants the design-quality (card/garble) check. Otherwise skip.
  if (expectedLines.length === 0 && !options.checkDesignQuality) return clean;

  const clients = [primaryAnthropic, backupAnthropic].filter(Boolean) as Anthropic[];
  if (clients.length === 0) return clean;

  let shrunk: { base64: string; mediaType: "image/jpeg" };
  try {
    shrunk = await shrinkForVision(imageBuffer);
  } catch {
    return clean;
  }

  const contactBlock = expectedLines.length
    ? `\n\nThe design MUST show these EXACT values (character-for-character). Read the text actually rendered and compare:\n${expectedLines.join("\n")}\n\n1. CONTACT/BRAND TEXT: for each value above that appears, does the rendered text match EXACTLY? Image models garble emails/URLs/phones (e.g. "gmail.com" → "gmailol.com", a city misspelled, a missing digit). For each MISMATCH report field, expected, and what the image shows.\n2. HEADLINE DUPLICATION: is any headline word/phrase DUPLICATED — printed twice, stacked, ghosted, or echoed in a second font?`
    : "";
  const qualityBlock = options.checkDesignQuality
    ? `\n\n3. CARD-ON-A-SURFACE: is the whole design rendered as a card / flyer / poster / rounded translucent panel FLOATING on a separate background (a visible border, margin, drop shadow, or different backdrop around the design)? A correct design fills the ENTIRE frame edge-to-edge as one layer. true only if there is clear nesting.\n4. GARBLED TEXT: does any rendered word read as gibberish / a misspelled non-word the model mangled (e.g. "bookesepheeming", "Intecyices", "Pittseris", "Sool")? true only if you can clearly see nonsense words, not for normal real words.`
    : "";

  const prompt = `You are a strict QA reviewer checking a finished marketing design image.${contactBlock}${qualityBlock}

Return STRICT JSON only, no prose:
{"contactIssues":[{"field":"email","expected":"...","found":"..."}],"headlineDuplicated":false,"cardOnSurface":false,"garbledText":false,"summary":"one short line"}
If everything is correct return all-empty/false with summary "clean".`;

  for (const client of clients) {
    try {
      const response = await client.messages.create({
        model: VISION_MODEL as Parameters<typeof client.messages.create>[0]["model"],
        max_tokens: 600,
        system: "You are a meticulous design QA reviewer. Return strict JSON only.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: shrunk.mediaType, data: shrunk.base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      const text = response.content.map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as {
        contactIssues?: Array<{ field?: string; expected?: string; found?: string }>;
        headlineDuplicated?: boolean;
        cardOnSurface?: boolean;
        garbledText?: boolean;
        summary?: string;
      };
      const contactIssues: DesignTextIssue[] = Array.isArray(parsed.contactIssues)
        ? parsed.contactIssues
            .filter((i) => i && typeof i.expected === "string" && typeof i.found === "string" && i.expected !== i.found)
            .map((i) => ({ field: String(i.field ?? "text"), expected: String(i.expected), found: String(i.found) }))
        : [];
      const headlineDuplicated = parsed.headlineDuplicated === true;
      const cardOnSurface = !!options.checkDesignQuality && parsed.cardOnSurface === true;
      const garbledText = !!options.checkDesignQuality && parsed.garbledText === true;
      return {
        ok: contactIssues.length === 0 && !headlineDuplicated && !cardOnSurface && !garbledText,
        contactIssues,
        headlineDuplicated,
        cardOnSurface,
        garbledText,
        source: "vision",
        summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      };
    } catch (err) {
      console.warn("[verify-design-text] vision call failed:", err instanceof Error ? err.message : err);
    }
  }
  // Vision failed on all clients → don't block delivery.
  return clean;
}
