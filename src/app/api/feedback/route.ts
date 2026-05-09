import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { uploadToS3 } from "@/lib/utils/s3-client";

const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function cleanString(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeCategory(value: string) {
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 40);
  return clean || "GENERAL";
}

function getExtension(file: File) {
  const fromName = file.name.split(".").pop() || "";
  const clean = fromName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8);
  if (clean) return clean;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function createReferenceCode() {
  return `FSB-${nanoid(8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const formData = await request.formData();
    const message = cleanString(formData.get("message"), 4000);
    const category = sanitizeCategory(cleanString(formData.get("category"), 60));
    const pageUrl = cleanString(formData.get("pageUrl"), 1000) || null;
    const viewport = cleanString(formData.get("viewport"), 120) || null;
    const clientUserAgent = cleanString(formData.get("userAgent"), 600);
    const userAgent = clientUserAgent || request.headers.get("user-agent")?.slice(0, 600) || null;
    const screenshot = formData.get("screenshot") as File | null;

    if (!message || message.length < 6) {
      return NextResponse.json(
        { success: false, error: { message: "Describe the issue so we can reproduce it." } },
        { status: 400 }
      );
    }

    const referenceCode = createReferenceCode();
    const screenshotUrls: string[] = [];

    if (screenshot && screenshot.size > 0) {
      if (!ALLOWED_SCREENSHOT_TYPES.has(screenshot.type)) {
        return NextResponse.json(
          { success: false, error: { message: "Screenshot must be PNG, JPG, or WebP." } },
          { status: 400 }
        );
      }
      if (screenshot.size > MAX_SCREENSHOT_SIZE) {
        return NextResponse.json(
          { success: false, error: { message: "Screenshot must be 10MB or smaller." } },
          { status: 400 }
        );
      }

      const bytes = await screenshot.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const extension = getExtension(screenshot);
      const key = `feedback/${session.userId}/${referenceCode}-${Date.now()}.${extension}`;
      const url = await uploadToS3(key, buffer, screenshot.type || "image/jpeg");
      screenshotUrls.push(url);
    }

    const report = await prisma.feedbackReport.create({
      data: {
        referenceCode,
        userId: session.userId,
        category,
        message,
        screenshotUrls: JSON.stringify(screenshotUrls),
        pageUrl,
        userAgent,
        viewport,
      },
      select: {
        id: true,
        referenceCode: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        report: {
          ...report,
          createdAt: report.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create feedback report error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit feedback report" } },
      { status: 500 }
    );
  }
}
