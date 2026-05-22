import { prisma } from "@/lib/db/client";

export interface RotationResult {
  url: string | null;
  fileId: string | null;
  mediaType: string | null;
  nextIndex: number;
  emptyFolder: boolean;
  folderMissing: boolean;
}

/**
 * Pick the next media file from a folder using round-robin, advancing the
 * lastUsedIndex. Caller is responsible for persisting `nextIndex` back onto
 * the ContentAutomation row.
 *
 * Returns nulls when the folder is empty, missing, or has no readable files —
 * caller should fall back gracefully (typically: skip media, post text-only).
 */
export async function pickNextFromFolder(
  folderId: string,
  lastUsedIndex: number,
): Promise<RotationResult> {
  const folder = await prisma.mediaFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  });
  if (!folder) {
    return {
      url: null,
      fileId: null,
      mediaType: null,
      nextIndex: 0,
      emptyFolder: false,
      folderMissing: true,
    };
  }

  const files = await prisma.mediaFile.findMany({
    where: { folderId, type: { in: ["image", "video"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, type: true },
  });

  if (files.length === 0) {
    return {
      url: null,
      fileId: null,
      mediaType: null,
      nextIndex: 0,
      emptyFolder: true,
      folderMissing: false,
    };
  }

  // Round-robin with bounds guard (folder size may have shrunk).
  const safeIndex = ((lastUsedIndex % files.length) + files.length) % files.length;
  const chosen = files[safeIndex];

  return {
    url: chosen.url,
    fileId: chosen.id,
    mediaType: chosen.type,
    nextIndex: (safeIndex + 1) % files.length,
    emptyFolder: false,
    folderMissing: false,
  };
}

/**
 * Resolve a specific MediaFile by ID (with safety check that it still exists).
 */
export async function resolveSpecificMedia(
  fileId: string,
): Promise<{ url: string; mediaType: string } | null> {
  const file = await prisma.mediaFile.findUnique({
    where: { id: fileId },
    select: { url: true, type: true },
  });
  if (!file) return null;
  return { url: file.url, mediaType: file.type };
}
