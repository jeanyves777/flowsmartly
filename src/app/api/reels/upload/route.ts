import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPresignedUploadUrl, getContentType } from "@/lib/utils/s3-client";

// POST /api/reels/upload — get a presigned URL to upload a source video, then
// call POST /api/reels with the returned sourceFileUrl to transcribe + build.
// Body: { filename, contentType? }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const filename = typeof body.filename === "string" && body.filename ? body.filename : "video.mp4";
    const contentType = typeof body.contentType === "string" && body.contentType ? body.contentType : getContentType(filename);
    const safe = filename.replace(/[^\w.-]/g, "_");
    const key = `reels/sources/${session.userId}/${Date.now()}-${safe}`;
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType, 3 * 1024 * 1024 * 1024);
    return NextResponse.json({ uploadUrl, sourceFileUrl: publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload init failed" }, { status: 400 });
  }
}
