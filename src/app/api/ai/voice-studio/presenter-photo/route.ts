import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadToS3 } from "@/lib/utils/s3-client";

/**
 * POST — upload a PRESENTER photo (the on-camera clone source for Avatar IV) to our
 * S3 and return its URL. Project-less: the brief picks the presenter BEFORE the
 * narration exists, then passes the URL in the create body. A raw image URL (not a
 * HeyGen talking_photo) is what the audio-driven Avatar IV path wants — zero avatar
 * quota. Accepts multipart form-data ("file") or JSON { dataUrl }. [[voice-oncam-explainer-feature]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

  let buffer: Buffer | null = null;
  let ext = "jpg";
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file && typeof file !== "string") {
        buffer = Buffer.from(await file.arrayBuffer());
        ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as { dataUrl?: string };
      const m = /^data:image\/([a-z+]+);base64,(.+)$/i.exec(body.dataUrl || "");
      if (m) { ext = m[1].replace("jpeg", "jpg"); buffer = Buffer.from(m[2], "base64"); }
    }
  } catch { /* validation below */ }

  if (!buffer || buffer.length === 0) return NextResponse.json({ success: false, error: { message: "No image provided." } }, { status: 400 });
  if (buffer.length > 12 * 1024 * 1024) return NextResponse.json({ success: false, error: { message: "Image is too large (max 12MB)." } }, { status: 400 });

  try {
    const url = await uploadToS3(`narration/presenter/${session.userId}-${Date.now()}.${ext}`, buffer, `image/${ext === "jpg" ? "jpeg" : ext}`);
    return NextResponse.json({ success: true, data: { url } });
  } catch (e) {
    return NextResponse.json({ success: false, error: { message: e instanceof Error ? e.message : "Upload failed." } }, { status: 502 });
  }
}
