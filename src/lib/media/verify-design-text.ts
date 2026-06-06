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
): Promise<DesignTextVerdict> {
  const expectedLines = [
    expected.brandName ? `Brand name: ${expected.brandName}` : null,
    expected.phone ? `Phone: ${expected.phone}` : null,
    expected.email ? `Email: ${expected.email}` : null,
    expected.website ? `Website: ${expected.website}` : null,
    expected.address ? `Address: ${expected.address}` : null,
  ].filter(Boolean) as string[];

  // Nothing precise to verify → skip (headline-duplication alone isn't worth a
  // vision call when there are no exact strings the model could garble).
  if (expectedLines.length === 0) return { ok: true, contactIssues: [], headlineDuplicated: false, source: "skipped" };

  const clients = [primaryAnthropic, backupAnthropic].filter(Boolean) as Anthropic[];
  if (clients.length === 0) return { ok: true, contactIssues: [], headlineDuplicated: false, source: "skipped" };

  let shrunk: { base64: string; mediaType: "image/jpeg" };
  try {
    shrunk = await shrinkForVision(imageBuffer);
  } catch {
    return { ok: true, contactIssues: [], headlineDuplicated: false, source: "skipped" };
  }

  const prompt = `You are a strict proofreader QA-checking a finished marketing design image.

The design MUST show these EXACT values (character-for-character). Read the text actually rendered in the image and compare:
${expectedLines.join("\n")}

Report TWO things:
1. CONTACT/BRAND TEXT: for each value above that appears in the image, does the rendered text match EXACTLY? Image models often garble emails/URLs/phones (e.g. "gmail.com" rendered as "gmailol.com", "https://www" as "https:/ww", a city misspelled, a missing digit or paren). For each MISMATCH, report the field, the expected value, and what the image actually shows.
2. HEADLINE DUPLICATION: is any headline word or phrase DUPLICATED — printed twice, stacked, ghosted, or repeated (e.g. "weekend go-o go-to", or the same word echoed in a second font)?

Return STRICT JSON only, no prose:
{"contactIssues":[{"field":"email","expected":"...","found":"..."}],"headlineDuplicated":false,"summary":"one short line"}
If everything is correct, return {"contactIssues":[],"headlineDuplicated":false,"summary":"clean"}.`;

  for (const client of clients) {
    try {
      const response = await client.messages.create({
        model: VISION_MODEL as Parameters<typeof client.messages.create>[0]["model"],
        max_tokens: 600,
        system: "You are a meticulous proofreader. Compare rendered image text to the expected values. Return strict JSON only.",
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
        summary?: string;
      };
      const contactIssues: DesignTextIssue[] = Array.isArray(parsed.contactIssues)
        ? parsed.contactIssues
            .filter((i) => i && typeof i.expected === "string" && typeof i.found === "string" && i.expected !== i.found)
            .map((i) => ({ field: String(i.field ?? "text"), expected: String(i.expected), found: String(i.found) }))
        : [];
      const headlineDuplicated = parsed.headlineDuplicated === true;
      return {
        ok: contactIssues.length === 0 && !headlineDuplicated,
        contactIssues,
        headlineDuplicated,
        source: "vision",
        summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      };
    } catch (err) {
      console.warn("[verify-design-text] vision call failed:", err instanceof Error ? err.message : err);
    }
  }
  // Vision failed on all clients → don't block delivery.
  return { ok: true, contactIssues: [], headlineDuplicated: false, source: "skipped" };
}
