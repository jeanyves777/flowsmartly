import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import { uploadToS3 } from "@/lib/utils/s3-client";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

// Wide banner allows a bigger file than a small logo.
const LIMITS: Record<"logo" | "banner", number> = { logo: 6 * 1024 * 1024, banner: 12 * 1024 * 1024 };
const OK_IMAGE = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];

/**
 * POST — set the join-page logo or banner.
 *
 *  - multipart/form-data { kind: "logo"|"banner", file } → upload SERVER-SIDE to
 *    S3 (the presigned browser PUT 403s on this bucket) and store the URL.
 *  - application/json { clear: "logo"|"banner" } → drop the override. For the
 *    logo that means the join page falls back to the owner's Brand Kit logo.
 *
 * Host only. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can brand the join page", 403);

  const contentType = request.headers.get("content-type") || "";

  // ---- clear an override (revert the logo to the Brand Kit) ----
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { clear?: "logo" | "banner" };
    if (body.clear !== "logo" && body.clear !== "banner") return err("Nothing to clear");
    await prisma.trainingSession.update({
      where: { id },
      data: body.clear === "logo" ? { joinLogoUrl: null } : { joinBannerUrl: null },
    });
    const dto = await getSessionDTO(id);
    return NextResponse.json({ success: true, data: { session: dto } });
  }

  // ---- upload a logo or banner ----
  const form = await request.formData().catch(() => null);
  const kind = String(form?.get("kind") || "");
  const file = form?.get("file");
  if (kind !== "logo" && kind !== "banner") return err("Say whether this is a logo or a banner");
  if (!(file instanceof File)) return err("No file");
  if (!OK_IMAGE.includes(file.type)) return err("Use an image — PNG, JPG, WEBP or SVG");
  if (file.size > LIMITS[kind]) return err(`That image is too big (max ${Math.round(LIMITS[kind] / 1024 / 1024)}MB)`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const safe = (file.name || kind).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `training/${id}/brand/${kind}-${Date.now()}-${safe}`;
  const url = await uploadToS3(key, buffer, file.type);

  await prisma.trainingSession.update({
    where: { id },
    data: kind === "logo" ? { joinLogoUrl: url } : { joinBannerUrl: url },
  });

  const dto = await getSessionDTO(id);
  return NextResponse.json({ success: true, data: { session: dto, url } });
}
