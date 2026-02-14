import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { compositeImageWithText } from "@/lib/media/image-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";

// POST /api/media/composite — Composite text onto an image
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      baseImageUrl,
      text,
      position = "bottom",
      fontSize = 40,
      fontColor = "#FFFFFF",
      backgroundColor = "rgba(0,0,0,0.55)",
      outputWidth = 512,
      outputHeight = 512,
    } = body as {
      baseImageUrl: string;
      text: string;
      position?: "top" | "center" | "bottom";
      fontSize?: number;
      fontColor?: string;
      backgroundColor?: string;
      outputWidth?: number;
      outputHeight?: number;
    };

    if (!baseImageUrl || !text?.trim()) {
      return NextResponse.json(
        { success: false, error: "baseImageUrl and text are required" },
        { status: 400 }
      );
    }

    const pngBuffer = await compositeImageWithText({
      baseImageUrl,
      text,
      position,
      fontSize,
      fontColor,
      backgroundColor,
      outputWidth,
      outputHeight,
    });

    // Upload to S3
    const key = `media/composite-${session.userId}-${Date.now()}.png`;
    const url = await uploadToS3(key, pngBuffer, "image/png");

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error("Image composite error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to composite image" },
      { status: 500 }
    );
  }
}
