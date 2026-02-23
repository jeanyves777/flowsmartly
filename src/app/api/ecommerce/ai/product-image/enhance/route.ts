import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { randomUUID } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { readFile } from "fs/promises";

// ── POST /api/ecommerce/ai/product-image/enhance ──

export async function POST(request: NextRequest) {
  let tempPath: string | null = null;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "No image file provided" } },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TYPE", message: "Invalid file type. Allowed: PNG, JPEG, WebP" } },
        { status: 400 }
      );
    }

    // Validate file size (10MB max for enhancement)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: "FILE_TOO_LARGE", message: "File too large. Maximum 10MB." } },
        { status: 400 }
      );
    }

    // Credit check
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_PRODUCT_IMAGE");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    // Check rembg availability
    if (!isRembgAvailable()) {
      return NextResponse.json(
        { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Background removal is not available on this server" } },
        { status: 503 }
      );
    }

    // Save uploaded file to temp path
    const tempDir = path.join(process.cwd(), "tmp", "product-enhance");
    await mkdir(tempDir, { recursive: true });

    const ext = imageFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10) || "png";
    tempPath = path.join(tempDir, `${randomUUID()}.${ext}`);

    const bytes = await imageFile.arrayBuffer();
    await writeFile(tempPath, Buffer.from(bytes));

    // Also upload the original to S3 so we can return its URL
    const originalKey = `products/originals/${randomUUID()}.${ext}`;
    const originalUrl = await uploadToS3(originalKey, Buffer.from(bytes), imageFile.type);

    // Remove background
    const result = await removeBackground(tempPath);

    // Read the output file and upload to S3
    const outputBuffer = await readFile(result.outputPath);
    const enhancedKey = `products/enhanced/${randomUUID()}.png`;
    const imageUrl = await uploadToS3(enhancedKey, outputBuffer, "image/png");

    // Clean up local bg-removed file too
    try {
      await unlink(result.outputPath);
    } catch { /* ignore cleanup errors */ }

    // Deduct credits
    const creditCost = await getDynamicCreditCost("AI_PRODUCT_IMAGE");
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: "AI product image enhancement (background removal)",
      referenceType: "ai_product_image_enhance",
    });

    return NextResponse.json({
      success: true,
      data: { imageUrl, originalUrl },
    });
  } catch (error) {
    console.error("AI product image enhancement error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to enhance product image" } },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch { /* ignore cleanup errors */ }
    }
  }
}
