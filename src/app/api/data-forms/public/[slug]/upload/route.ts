import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/data-forms/public/[slug]/upload
// Public photo upload for Smart Collect forms (no auth, rate-limited)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Verify form exists and is active Smart Collect
    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: { id: true, type: true, status: true, userId: true },
    });

    if (!form || form.status !== "ACTIVE" || !['SMART_COLLECT','ATTENDANCE'].includes(form.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: "No file provided" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Only PNG, JPEG, and WebP images are allowed" } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { message: "File too large. Maximum 5MB" } },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10) || "jpg";
    const filename = `contact-photos/${form.userId}-${randomUUID().substring(0, 8)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const url = await uploadToS3(filename, buffer, file.type);

    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    console.error("Smart collect upload error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Upload failed" } },
      { status: 500 }
    );
  }
}
