import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";
import {
  getCampaign,
  saveCharacterPreviewToLibrary,
  updateCampaignState,
} from "@/lib/story-ad-campaign";

/**
 * Set a character's reference image from a user-supplied URL or uploaded file.
 *
 * Two input modes:
 *   - JSON body: { url } — points the character at an existing media-library URL
 *     the user picked. We just record the pointer.
 *   - multipart/form-data with a "file" field — fresh upload. We re-host on S3
 *     under the campaign's character folder so the URL is stable + presignable.
 *
 * Either way we mark the character `previewStatus: "ready"` and `approved: false`
 * (approval is per-edit) and drop a MediaFile pointer into the user's per-campaign
 * library subfolder so they can find it later.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id, characterId } = await params;
  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  const character = current.state.characters.find((c) => c.id === characterId);
  if (!character) {
    return NextResponse.json({ success: false, error: { message: "Character not found" } }, { status: 404 });
  }

  let referenceImageUrl: string | null = null;

  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      // File upload — copy bytes into our S3 bucket under the campaign folder.
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: { message: "Expected a 'file' field with the image." } },
          { status: 400 },
        );
      }
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: { message: "Image is too large (15 MB max)." } },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/png";
      const ext = mime.split("/")[1]?.toLowerCase() || "png";
      const safe = character.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "character";
      const key = `story-ad-campaigns/${id}/characters/custom-${safe}-${nanoid(6)}.${ext}`;
      referenceImageUrl = await uploadToS3(key, buffer, mime);
    } else {
      // JSON body with a URL (e.g. user picked from media library)
      const body = (await request.json().catch(() => ({}))) as { url?: string };
      if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Provide either a multipart 'file' or JSON { url }." } },
          { status: 400 },
        );
      }
      referenceImageUrl = body.url.trim();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }

  if (!referenceImageUrl) {
    return NextResponse.json(
      { success: false, error: { message: "No image resolved." } },
      { status: 400 },
    );
  }

  // Persist the new portrait on the character. Editing the image always invalidates approval.
  const nextCharacters = current.state.characters.map((c) =>
    c.id === characterId
      ? {
          ...c,
          referenceImageUrl,
          previewStatus: "ready" as const,
          previewError: null,
          approved: false,
        }
      : c,
  );
  const merged = await updateCampaignState(id, session.userId, { characters: nextCharacters });

  // Drop a pointer into the user's per-campaign library subfolder for reuse.
  void saveCharacterPreviewToLibrary({
    userId: session.userId,
    campaignId: id,
    campaignTitle: current.state.brief?.slice(0, 60) || "Campaign",
    characterName: character.name,
    characterRole: character.role,
    imageUrl: referenceImageUrl,
  });

  return NextResponse.json({ success: true, data: { state: merged } });
}
