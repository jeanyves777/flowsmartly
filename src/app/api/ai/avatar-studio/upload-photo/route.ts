import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { heygenClient } from "@/lib/ai/heygen-client";

/**
 * POST — upload a user photo to HeyGen and return a reusable talking_photo id
 * to use as the avatar for a Photo → video render. Accepts multipart form-data
 * ("file") or JSON { dataUrl } (base64 data URL).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  if (!heygenClient.isAvailable()) {
    return NextResponse.json({ success: false, error: { message: "HeyGen is not configured." } }, { status: 503 });
  }

  let buffer: Buffer | null = null;
  let mimeType = "image/jpeg";
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file && typeof file !== "string") {
        mimeType = file.type || mimeType;
        buffer = Buffer.from(await file.arrayBuffer());
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as { dataUrl?: string };
      const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(body.dataUrl || "");
      if (m) { mimeType = m[1]; buffer = Buffer.from(m[2], "base64"); }
    }
  } catch { /* fall through to validation */ }

  if (!buffer || buffer.length === 0) {
    return NextResponse.json({ success: false, error: { message: "No image provided." } }, { status: 400 });
  }
  if (buffer.length > 12 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: { message: "Image is too large (max 12MB)." } }, { status: 400 });
  }

  try {
    const { id, previewUrl } = await heygenClient.uploadTalkingPhoto(buffer, mimeType);
    return NextResponse.json({ success: true, data: { avatarId: id, previewUrl } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Photo upload failed.";
    return NextResponse.json({ success: false, error: { message } }, { status: 502 });
  }
}
