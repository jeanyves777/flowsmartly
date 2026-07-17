/**
 * ONE loader for a brand logo, wherever it came from.
 *
 * A BrandKit logo is stored as a PRESIGNED S3 URL, and a presigned URL expires
 * (X-Amz-Expires=3600). Every server-side use of it — the film outro, the logo
 * overlay, a composited image — happens long after signing, so a plain fetch()
 * of the stored URL returns 403 and the branding SILENTLY disappears (the video
 * outro was the visible symptom: "Logo on" produced no outro). For our OWN
 * objects we therefore read by KEY with the authenticated client, which cannot
 * expire; anything else is fetched normally.
 *
 * Every logo consumer must go through here — three near-identical private copies
 * of this loader is exactly how the video path drifted from the image path (which
 * re-signed and kept working). [[image-pipeline-providers]]
 */
import fs from "fs";
import path from "path";
import { downloadS3ObjectToBuffer, isS3Url } from "@/lib/utils/s3-client";

/** Logo bytes, or null if it can't be loaded. Never throws. */
export async function loadLogoBuffer(src: string): Promise<Buffer | null> {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) {
      const b64 = src.replace(/^data:image\/[^;]+;base64,/, "");
      return b64 ? Buffer.from(b64, "base64") : null;
    }

    // Our own object → authenticated read by key. Do this BEFORE any fetch: the
    // stored URL's signature is almost always stale by the time we render.
    if (isS3Url(src) || src.startsWith("/uploads/")) {
      try {
        return await downloadS3ObjectToBuffer(src);
      } catch {
        /* fall through — try it as a plain URL below */
      }
    }

    if (/^https?:\/\//i.test(src)) {
      try {
        const res = await fetch(src);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch {
        /* fall through */
      }
      // A failure on a URL that looks like ours = an expired signature (or a
      // proxy wrapper). extractS3Key strips the query, so re-read it by key.
      try {
        return await downloadS3ObjectToBuffer(src);
      } catch {
        return null;
      }
    }

    if (src.startsWith("/")) {
      const local = path.join(process.cwd(), "public", src);
      if (fs.existsSync(local)) return fs.readFileSync(local);
    }
    if (fs.existsSync(src)) return fs.readFileSync(src);
    return null;
  } catch {
    return null;
  }
}

/** Same, but throws with a clear reason — for callers that must not silently skip branding. */
export async function requireLogoBuffer(src: string, label = "logo"): Promise<Buffer> {
  const buf = await loadLogoBuffer(src);
  if (!buf || buf.length === 0) throw new Error(`Could not load ${label} from ${String(src).split("?")[0].slice(0, 120)}`);
  return buf;
}
