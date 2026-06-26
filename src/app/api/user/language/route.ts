import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getUserPreferredLanguage, isSupportedLanguage } from "@/lib/ai/user-language";

/**
 * Lightweight preferred-language endpoint for the UI language switcher.
 *
 * The single source of truth is `BrandKit.preferredLanguage` (a BCP-47 tag),
 * which EVERY AI surface already respects via `getUserPreferredLanguage`. The
 * full /api/brand POST requires the whole brand kit, so this route exists to
 * flip just the language without resubmitting the entire kit.
 */

// GET /api/user/language — current preferred language (never throws → "en")
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const language = await getUserPreferredLanguage(session.userId);
  return NextResponse.json({ success: true, data: { language } });
}

// PATCH /api/user/language — set preferred language on the user's brand kit(s)
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const tag = typeof body?.language === "string" ? body.language : "";
  if (!isSupportedLanguage(tag)) {
    return NextResponse.json({ success: false, error: { message: "Unsupported language" } }, { status: 400 });
  }
  // Write to every brand kit the user owns so the default + any others agree.
  const res = await prisma.brandKit.updateMany({
    where: { userId: session.userId },
    data: { preferredLanguage: tag },
  });
  // persisted=false means the user has no brand kit yet; the UI keeps the
  // choice locally and it takes effect once a brand kit exists.
  return NextResponse.json({ success: true, data: { language: tag, persisted: res.count > 0 } });
}
