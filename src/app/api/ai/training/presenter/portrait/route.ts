import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

const OK = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX = 8 * 1024 * 1024;

/**
 * POST /api/ai/training/presenter/portrait — upload the picture shown for the AI
 * presenter (in the participant list + preview). Server-side S3 upload, same path
 * as the room's other media (the presigned browser-PUT path 403s on this bucket).
 * [[training-studio]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Sign in to upload a portrait", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return err("No image");
  if (!OK.includes(file.type)) return err("Use a PNG, JPG or WEBP image");
  if (file.size > MAX) return err("That image is too big (max 8MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const url = await uploadToS3(`presenters/${session.userId}/${nanoid(8)}.${ext}`, buffer, file.type);
  return NextResponse.json({ success: true, data: { url } });
}
