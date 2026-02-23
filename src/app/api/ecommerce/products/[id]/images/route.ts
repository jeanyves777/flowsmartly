import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_PER_PRODUCT = 10;

// ── POST /api/ecommerce/products/[id]/images ──

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "Store not found" } },
        { status: 404 }
      );
    }

    const product = await prisma.product.findFirst({
      where: { id, storeId: store.id, deletedAt: null },
      select: { id: true, images: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    const existingImages: Array<{ url: string; alt: string; position: number }> = JSON.parse(product.images || "[]");

    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NO_FILES", message: "No image files provided" } },
        { status: 400 }
      );
    }

    if (existingImages.length + files.length > MAX_IMAGES_PER_PRODUCT) {
      return NextResponse.json(
        { success: false, error: { code: "TOO_MANY_IMAGES", message: `Maximum ${MAX_IMAGES_PER_PRODUCT} images per product. You already have ${existingImages.length}.` } },
        { status: 400 }
      );
    }

    // Validate all files first
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_TYPE", message: `Invalid file type: ${file.name}. Allowed: PNG, JPEG, WebP` } },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: { code: "FILE_TOO_LARGE", message: `File too large: ${file.name}. Maximum 5MB per image.` } },
          { status: 400 }
        );
      }
    }

    // Upload each file to S3
    const newImages: Array<{ url: string; alt: string; position: number }> = [];
    let nextPosition = existingImages.length > 0
      ? Math.max(...existingImages.map((img) => img.position)) + 1
      : 0;

    for (const file of files) {
      const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10) || "png";
      const filename = `products/${store.id}/${product.id}-${randomUUID().substring(0, 8)}.${ext}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const url = await uploadToS3(filename, buffer, file.type);

      newImages.push({
        url,
        alt: file.name.replace(/\.[^/.]+$/, ""),
        position: nextPosition,
      });
      nextPosition++;
    }

    // Merge and update
    const allImages = [...existingImages, ...newImages];

    await prisma.product.update({
      where: { id: product.id },
      data: { images: JSON.stringify(allImages) },
    });

    return NextResponse.json({
      success: true,
      data: { images: allImages },
    });
  } catch (error) {
    console.error("Product image upload error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to upload images" } },
      { status: 500 }
    );
  }
}
