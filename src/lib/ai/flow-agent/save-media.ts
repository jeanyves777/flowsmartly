import { prisma } from "@/lib/db/client";

/**
 * Persist an agent-generated asset to the user's Media Library so it
 * shows up in /media alongside everything else they create. The media
 * library reads `MediaFile` — we mirror the shape used by
 * /api/media (POST). Best-effort: never throws (a media-library write
 * failing must not fail the generation task).
 */
export async function saveToMediaLibrary(params: {
  userId: string;
  url: string;
  type: "image" | "video" | "audio" | "document";
  mimeType: string;
  size?: number;
  originalName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const ext = extFor(params.type, params.mimeType);
    const filename = params.url.split("/").pop() || `flow-ai-${Date.now()}.${ext}`;
    const file = await prisma.mediaFile.create({
      data: {
        userId: params.userId,
        filename,
        originalName: params.originalName || filename,
        url: params.url,
        type: params.type,
        mimeType: params.mimeType,
        size: params.size ?? 0,
        folderId: null,
        tags: JSON.stringify(params.tags ?? ["flow-ai"]),
        metadata: JSON.stringify({ source: "flow_ai_agent", ...(params.metadata ?? {}) }),
      },
      select: { id: true },
    });
    return file.id;
  } catch (e) {
    console.error("[flow-agent] saveToMediaLibrary failed (non-fatal):", e);
    return null;
  }
}

function extFor(type: string, mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return type === "video" ? "mp4" : type === "audio" ? "mp3" : type === "document" ? "pdf" : "png";
}
