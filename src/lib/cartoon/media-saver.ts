/**
 * Media Library Saver
 *
 * Saves cartoon assets (characters, videos) to the user's media library
 */

import { prisma } from "@/lib/db/client";

/**
 * Get or create a "Cartoon Maker" folder in user's media library
 */
export async function getOrCreateCartoonFolder(userId: string): Promise<string> {
  const folderName = "Cartoon Maker";

  // Check if folder exists
  let folder = await prisma.mediaFolder.findFirst({
    where: {
      userId,
      name: folderName,
      parentId: null, // Root level folder
    },
  });

  if (!folder) {
    // Create the folder
    folder = await prisma.mediaFolder.create({
      data: {
        userId,
        name: folderName,
      },
    });
  }

  return folder.id;
}

/**
 * Get or create a project subfolder within Cartoon Maker
 */
export async function getOrCreateProjectFolder(
  userId: string,
  projectName: string
): Promise<string> {
  const cartoonFolderId = await getOrCreateCartoonFolder(userId);

  // Check if project folder exists
  let folder = await prisma.mediaFolder.findFirst({
    where: {
      userId,
      name: projectName,
      parentId: cartoonFolderId,
    },
  });

  if (!folder) {
    // Create the project folder
    folder = await prisma.mediaFolder.create({
      data: {
        userId,
        name: projectName,
        parentId: cartoonFolderId,
      },
    });
  }

  return folder.id;
}

/**
 * Save a file to the media library
 */
export async function saveToMediaLibrary(options: {
  userId: string;
  url: string;
  filename: string;
  originalName: string;
  type: "image" | "video";
  mimeType: string;
  size?: number;
  folderId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const {
    userId,
    url,
    filename,
    originalName,
    type,
    mimeType,
    size = 0,
    folderId,
    tags = [],
    metadata = {},
  } = options;

  const mediaFile = await prisma.mediaFile.create({
    data: {
      userId,
      filename,
      originalName,
      url,
      type,
      mimeType,
      size,
      folderId,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify(metadata),
    },
  });

  return mediaFile.id;
}

/**
 * Save character preview images to media library
 */
export async function saveCharactersToLibrary(
  userId: string,
  projectName: string,
  characters: Array<{
    name: string;
    previewUrl?: string | null;
  }>
): Promise<void> {
  if (!characters.length) return;

  const folderId = await getOrCreateProjectFolder(userId, projectName);

  for (const char of characters) {
    if (!char.previewUrl) continue;

    try {
      await saveToMediaLibrary({
        userId,
        url: char.previewUrl,
        filename: `${char.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-character.png`,
        originalName: `${char.name} - Character Preview`,
        type: "image",
        mimeType: "image/png",
        folderId,
        tags: ["cartoon", "character", char.name],
        metadata: { characterName: char.name, source: "cartoon-maker" },
      });
    } catch (error) {
      console.error(`Failed to save character ${char.name} to library:`, error);
    }
  }
}

/**
 * Save scene background images to media library
 */
export async function saveSceneBackgroundsToLibrary(
  userId: string,
  projectName: string,
  sceneImages: Array<{
    sceneNumber: number;
    imageUrl: string;
  }>
): Promise<void> {
  if (!sceneImages.length) return;

  const folderId = await getOrCreateProjectFolder(userId, projectName);

  for (const scene of sceneImages) {
    if (!scene.imageUrl) continue;

    try {
      await saveToMediaLibrary({
        userId,
        url: scene.imageUrl,
        filename: `scene-${scene.sceneNumber}-background.png`,
        originalName: `Scene ${scene.sceneNumber} - Background`,
        type: "image",
        mimeType: "image/png",
        folderId,
        tags: ["cartoon", "background", `scene-${scene.sceneNumber}`],
        metadata: { sceneNumber: scene.sceneNumber, source: "cartoon-maker" },
      });
    } catch (error) {
      console.error(`Failed to save scene ${scene.sceneNumber} background to library:`, error);
    }
  }
}

/**
 * Save cartoon video to media library
 */
export async function saveVideoToLibrary(
  userId: string,
  projectName: string,
  videoUrl: string,
  thumbnailUrl: string | undefined,
  title: string
): Promise<string> {
  const folderId = await getOrCreateProjectFolder(userId, projectName);

  const mediaFileId = await saveToMediaLibrary({
    userId,
    url: videoUrl,
    filename: `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.mp4`,
    originalName: `${title} - Cartoon Video`,
    type: "video",
    mimeType: "video/mp4",
    folderId,
    tags: ["cartoon", "video", "ai-generated"],
    metadata: { title, source: "cartoon-maker", thumbnail: thumbnailUrl },
  });

  return mediaFileId;
}
