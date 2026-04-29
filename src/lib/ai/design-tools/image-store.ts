/**
 * Image Handle Store — shared working memory for design engine agents.
 *
 * Why an in-memory store with short string IDs instead of passing
 * base64 buffers between tool calls:
 *  - A single 1080×1080 PNG is ~1-3 MB. Base64-encoded inside Claude's
 *    tool_result blocks, that explodes the conversation context across
 *    every iteration of the agent loop. Eight tool rounds = 24+ MB of
 *    duplicated image data going back and forth — slow, expensive,
 *    and likely to bust the 1M context limit.
 *  - With handles ("img_001"), the agent passes around lightweight
 *    string references and we keep the real bytes in process memory.
 *
 * One store per agent run (constructed by the run function, scoped to
 * the request — no global state, no cross-request leakage). The agent
 * can `register` a fresh image (e.g. user's reference photo) at start,
 * and tools `register` new images they produce. The store is GC'd at
 * the end of the run.
 */

import { randomUUID } from "crypto";

export interface StoredImage {
  buffer: Buffer;
  /** Inferred from sharp metadata when available; "image/png" otherwise. */
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Pixel dimensions, populated lazily. */
  width?: number;
  height?: number;
  /** Where this image came from — useful for the agent's reasoning + telemetry. */
  source:
    | "user_reference"
    | "generated"
    | "edited"
    | "background_removed"
    | "composited"
    | "color_graded"
    | "drop_shadow_added"
    | "rotated"
    | "cropped"
    | "polaroid_framed"
    | "qr_code"
    | "brand_logo"
    | "decorative_shape";
  /** Free-form note from the producing tool — e.g. "background only, right zone clean". */
  note?: string;
}

export class ImageStore {
  private map = new Map<string, StoredImage>();
  private counter = 0;

  /** Add an image to the store; returns its handle. */
  register(image: StoredImage): string {
    this.counter += 1;
    const id = `img_${String(this.counter).padStart(3, "0")}_${randomUUID().slice(0, 6)}`;
    this.map.set(id, image);
    return id;
  }

  get(id: string): StoredImage {
    const img = this.map.get(id);
    if (!img) throw new Error(`Image handle not found: ${id}`);
    return img;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  /** Light summary the agent can scan without seeing raw bytes. */
  describe(id: string): string {
    const img = this.map.get(id);
    if (!img) return `${id}: NOT FOUND`;
    const dims = img.width && img.height ? `${img.width}×${img.height}` : "unknown size";
    const note = img.note ? ` — ${img.note}` : "";
    return `${id} (${img.source}, ${dims}, ${img.mimeType})${note}`;
  }

  /** All current handles + summaries — useful for telemetry / debugging. */
  inventory(): Array<{ id: string; summary: string }> {
    return Array.from(this.map.keys()).map((id) => ({ id, summary: this.describe(id) }));
  }

  /** Number of stored images — for budget reasoning. */
  size(): number {
    return this.map.size;
  }
}
