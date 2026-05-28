import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import type { FlowAgentTool } from "../registry";

/**
 * read_image — OCR + vision extraction of what's ON an uploaded image:
 * verbatim text plus structured fields (title, subtitle, names/author,
 * dates, contact info). The uploaded image is only in the model's vision
 * on the turn it's sent; this tool lets the agent reliably pull the details
 * INTO the transcript so it can CONFIRM them with the user and reuse them on
 * later turns (e.g. reproducing a book cover, a flyer, a business card).
 *
 * Reuses the platform's existing vision approach (same Haiku vision call the
 * analyze-media route uses). Free + read-only.
 */
const VISION_MODEL = process.env.FLOWCREATIVE_VISION_MODEL || "claude-haiku-4-5";

export const readImage: FlowAgentTool = {
  name: "read_image",
  description:
    "Read an uploaded/existing image with OCR + vision and return the text on it plus structured details (title, subtitle, author/names, dates, contact info) and a short description. Call this whenever the user uploads an image that CONTAINS text or details you'll need (a book cover, flyer, business card, poster, document) — extract the info and CONFIRM it with the user instead of asking them to retype what's already visible. Pass the uploaded attachment URL as imageUrl. Free + read-only.",
  input_schema: {
    type: "object",
    properties: {
      imageUrl: { type: "string", description: "REQUIRED — the uploaded/existing image URL to read." },
      focus: { type: "string", description: "Optional hint about what to extract (e.g. 'book title and author', 'contact details')." },
    },
    required: ["imageUrl"],
  },
  plans: null,
  costKey: "AGENT_LIST_FEATURES", // free
  mutating: false,
  handler: async (input, ctx) => {
    void ctx;
    try {
      const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
      if (!imageUrl) {
        return { ok: false, error_code: "missing_input", message: "imageUrl is required." };
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      const backupKey = process.env.ANTHROPIC_BACKUP_API_KEY;
      if (!apiKey && !backupKey) {
        return { ok: false, error_code: "upstream_failed", message: "Vision provider is not configured." };
      }

      const buffer = await loadImageBuffer(imageUrl);
      const shrunk = await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      const base64 = shrunk.toString("base64");

      const focus = typeof input.focus === "string" && input.focus.trim() ? input.focus.trim() : null;
      const prompt = `Read this image carefully (OCR). Return STRICT JSON only — no markdown, no commentary.
{
  "fullText": "every piece of text visible in the image, transcribed verbatim, line by line (use \\n between lines), or empty string if none",
  "title": "the main title/headline if any, else null",
  "subtitle": "any subtitle/tagline, else null",
  "names": ["any person/author/brand names visible"],
  "dates": ["any dates visible"],
  "contact": "any phone/email/website/address/social handles visible as one string, else null",
  "description": "1-2 sentence factual description of the image (layout, subject, style)"
}
${focus ? `Focus especially on: ${focus}\n` : ""}Transcribe text EXACTLY as written (keep spelling, accents, capitalization). Do not translate or invent.`;

      const clients = [apiKey, backupKey]
        .filter((k): k is string => !!k)
        .map((k) => new Anthropic({ apiKey: k }));

      let parsed: Record<string, unknown> | null = null;
      let lastError: unknown = null;
      for (const client of clients) {
        try {
          const resp = await client.messages.create({
            model: VISION_MODEL as Parameters<typeof client.messages.create>[0]["model"],
            max_tokens: 1200,
            system: "You are a precise OCR + visual reader. Return strict JSON only.",
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
                  { type: "text", text: prompt },
                ],
              },
            ],
          });
          const text = resp.content.map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
          const m = text.match(/\{[\s\S]*\}/);
          if (!m) throw new Error("No JSON in vision response");
          parsed = JSON.parse(m[0]) as Record<string, unknown>;
          if (parsed) break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!parsed) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: lastError instanceof Error ? lastError.message : "Could not read the image",
        };
      }

      return {
        ok: true,
        data: {
          ...parsed,
          guidance:
            "Show the user the extracted details (title, author/names, dates, contact, any text) and ASK them to confirm or correct before you use them. Don't make them retype what you've already read.",
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read image" };
    }
  },
};

async function loadImageBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const b64 = src.replace(/^data:[^;]+;base64,/, "");
    if (!b64) throw new Error("Invalid image data URI");
    return Buffer.from(b64, "base64");
  }
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "";
  const looksManaged =
    src.includes(".amazonaws.com/") || (storageUrl !== "" && src.startsWith(storageUrl)) || !src.startsWith("http");
  const fetchUrl = looksManaged ? await getPresignedUrl(src) : src;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
