import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getSiteDir, getOutputDir } from "@/lib/website/site-builder";

/**
 * POST /api/websites/[id]/upload-image
 * Uploads an image to the generated site's public/images/ directory.
 * Accepts: multipart form data with "file" field and "category" field.
 * Returns: { path: "/images/{category}/{filename}" }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "general";
    const customName = formData.get("filename") as string;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const siteDir = website.generatedPath || getSiteDir(id);
    const imageDir = join(siteDir, "public", "images", category);
    mkdirSync(imageDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "jpg";
    const safeName = (customName || file.name.replace(/\.[^.]+$/, "")).replace(/[^a-zA-Z0-9-_]/g, "-");
    const filename = `${safeName}-${Date.now()}.${ext}`;
    const filePath = join(imageDir, filename);

    writeFileSync(filePath, buffer);

    // Also copy to output dir for immediate access
    try {
      const outputImgDir = join(getOutputDir(website.slug), "images", category);
      mkdirSync(outputImgDir, { recursive: true });
      writeFileSync(join(outputImgDir, filename), buffer);
    } catch {}

    const imagePath = `/sites/${website.slug}/images/${category}/${filename}`;
    return NextResponse.json({ success: true, path: imagePath });
  } catch (err) {
    console.error("Upload image error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
