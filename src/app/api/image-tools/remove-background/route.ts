import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  removeBackground,
  isRembgAvailable,
} from "@/lib/image-tools/background-remover";
import type { BgRemovalModel } from "@/lib/image-tools/background-remover";
import { resolveToLocalPath, uploadLocalFileToS3 } from "@/lib/utils/s3-client";
import { writeFile, unlink, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { stat } from "fs/promises";

// POST /api/image-tools/remove-background
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (!isRembgAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Background removal service unavailable" },
        },
        { status: 503 }
      );
    }

    // Check credits
    const creditCheck = await checkCreditsForFeature(
      session.userId,
      "AI_BG_REMOVE",
      !!session.adminId
    );
    if (creditCheck) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: creditCheck.code,
            message: creditCheck.message,
          },
        },
        { status: 402 }
      );
    }

    // Parse input
    const contentType = request.headers.get("content-type") || "";
    let inputPath: string;
    let model: BgRemovalModel = "u2net";
    let tempInputPath: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      model = (formData.get("model") as BgRemovalModel) || "u2net";

      if (!file) {
        return NextResponse.json(
          { success: false, error: { message: "No file provided" } },
          { status: 400 }
        );
      }

      const tempDir = path.join(process.cwd(), "public", "uploads", "temp");
      await mkdir(tempDir, { recursive: true });
      tempInputPath = path.join(tempDir, `${randomUUID()}-${file.name}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempInputPath, buffer);
      inputPath = tempInputPath;
    } else {
      const body = await request.json();
      const { imageUrl, model: bodyModel } = body;
      model = bodyModel || "u2net";

      if (!imageUrl) {
        return NextResponse.json(
          { success: false, error: { message: "imageUrl is required" } },
          { status: 400 }
        );
      }

      // Remote URL → download to temp
      if (imageUrl.startsWith("http")) {
        const res = await fetch(imageUrl);
        if (!res.ok) {
          return NextResponse.json(
            {
              success: false,
              error: { message: "Failed to download image" },
            },
            { status: 400 }
          );
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const tempDir = path.join(process.cwd(), "public", "uploads", "temp");
        await mkdir(tempDir, { recursive: true });
        tempInputPath = path.join(tempDir, `${randomUUID()}.png`);
        await writeFile(tempInputPath, buffer);
        inputPath = tempInputPath;
      } else {
        inputPath = resolveToLocalPath(imageUrl);
      }
    }

    // Process background removal
    const result = await removeBackground(inputPath, { model });

    // Upload to S3
    const s3Key = `bg-removed/${path.basename(result.outputPath)}`;
    const s3Url = await uploadLocalFileToS3(result.outputPath, s3Key);

    // Get file size for media library
    const fileStat = await stat(result.outputPath);

    // Save to user's media library
    await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: path.basename(result.outputPath),
        originalName: `bg-removed-${Date.now()}.png`,
        url: s3Url,
        type: "image",
        mimeType: "image/png",
        size: fileStat.size,
        metadata: JSON.stringify({ source: "background-remover", model }),
      },
    });

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_BG_REMOVE");
    const deductResult = await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: "AI background removal",
      referenceType: "bg_remove",
      referenceId: s3Key,
    });

    // Clean up temp files
    if (tempInputPath) {
      await unlink(tempInputPath).catch(() => {});
    }
    // Clean up local output (already uploaded to S3)
    await unlink(result.outputPath).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: s3Url,
        creditsUsed: cost,
        creditsRemaining:
          deductResult.transaction?.balanceAfter ?? null,
      },
    });
  } catch (error) {
    console.error("[bg-remove] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Background removal failed",
        },
      },
      { status: 500 }
    );
  }
}
