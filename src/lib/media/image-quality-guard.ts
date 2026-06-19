import sharp from "sharp";

export interface BlankImageCheck {
  /** True when the image has essentially no content (black / white / solid / corrupt). */
  blank: boolean;
  /** Human-readable explanation for logs when blank. */
  reason?: string;
  maxStdev: number;
  maxRange: number;
}

/**
 * Detect a "dead" generation: a fully black, fully white, solid-colour, or
 * corrupt image. Providers (xAI grok-imagine, Imagen) occasionally return a
 * decodable-but-empty buffer on a soft safety block or a glitch. Those pass a
 * naive `if (base64)` check, so the logo gets composited onto a black frame and
 * the broken post ships. This guard lets callers reject the result and fall
 * through to the next provider instead.
 *
 * Heuristic: a real branded design has heavy pixel variation — stdev in the
 * dozens and a near-full 0–255 dynamic range in at least one channel. A blank
 * frame has ~0 stdev and ~0 range. We only flag images that are essentially
 * uniform, so a legitimate dark-background-with-bright-text design (high range,
 * high stdev) is never rejected.
 */
export async function isBlankImageBuffer(buffer: Buffer): Promise<BlankImageCheck> {
  try {
    const stats = await sharp(buffer).stats();
    const channels = stats.channels.slice(0, 3); // RGB only — ignore alpha
    if (channels.length === 0) {
      return { blank: true, reason: "no colour channels", maxStdev: 0, maxRange: 0 };
    }
    const maxStdev = Math.max(...channels.map((c) => c.stdev));
    const maxRange = Math.max(...channels.map((c) => c.max - c.min));
    const blank = maxStdev < 6 || maxRange < 16;
    return {
      blank,
      reason: blank
        ? `uniform image (maxStdev=${maxStdev.toFixed(1)}, maxRange=${maxRange})`
        : undefined,
      maxStdev,
      maxRange,
    };
  } catch (err) {
    // Unreadable buffer = not a usable image → treat as blank so the caller
    // falls through to the next provider rather than uploading garbage.
    return {
      blank: true,
      reason: `unreadable image: ${err instanceof Error ? err.message : String(err)}`,
      maxStdev: 0,
      maxRange: 0,
    };
  }
}

/** Convenience wrapper for callers holding a base64 string. */
export async function isBlankImageBase64(base64: string): Promise<BlankImageCheck> {
  return isBlankImageBuffer(Buffer.from(base64, "base64"));
}
