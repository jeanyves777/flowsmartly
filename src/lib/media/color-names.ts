import { HAIKU_MODEL, ai } from "@/lib/ai/client";

/**
 * Translate brand hex codes into short natural color names so the image
 * generation prompt can describe the palette without showing raw hex
 * strings (which xAI tends to render literally as text in the image).
 *
 * Uses Claude Haiku and caches results in-process by hex set — same brand
 * pays for at most ONE call until the server restarts.
 *
 * Returns null for any color the AI can't confidently name (rare).
 */

const cache = new Map<string, string | null>();

function normalize(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const trimmed = hex.trim();
  const m = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let value = m[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${value.toLowerCase()}`;
}

async function nameOne(hex: string): Promise<string | null> {
  const cached = cache.get(hex);
  if (cached !== undefined) return cached;

  try {
    const raw = await ai.generate(
      `Give me 2-4 words naming the color ${hex} in plain English (e.g. "deep azure blue", "warm sandy tan", "muted forest green"). Output ONLY the name — no preamble, no punctuation, no hex, lowercase.`,
      {
        model: HAIKU_MODEL,
        maxTokens: 30,
        temperature: 0.3,
        systemPrompt: "You name colors in plain English. Output just the name.",
      },
    );
    const cleaned = raw
      .replace(/[#"'`.]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, 60);
    const final = cleaned && /^[a-z][a-z\s-]+$/.test(cleaned) ? cleaned : null;
    cache.set(hex, final);
    return final;
  } catch (err) {
    console.warn(
      "[color-names] AI naming failed:",
      err instanceof Error ? err.message : err,
    );
    cache.set(hex, null);
    return null;
  }
}

export interface BrandColorNames {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
}

export async function nameBrandColors(input: {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
}): Promise<BrandColorNames> {
  const p = normalize(input.primary);
  const s = normalize(input.secondary);
  const a = normalize(input.accent);

  const [primary, secondary, accent] = await Promise.all([
    p ? nameOne(p) : Promise.resolve(null),
    s ? nameOne(s) : Promise.resolve(null),
    a ? nameOne(a) : Promise.resolve(null),
  ]);

  return { primary, secondary, accent };
}
