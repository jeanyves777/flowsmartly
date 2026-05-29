import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/client";
import { notifyPasswordReset } from "@/lib/notifications";

/**
 * Mobile password-reset request — native app. Same behaviour as the web
 * /api/auth/forgot-password (emails a reset link, never reveals whether the
 * account exists, rate-limited) but without Turnstile, which a native app
 * can't run. The reset link in the email opens the web reset page (standard).
 */
const schema = z.object({ email: z.string().email().toLowerCase().trim() });

function getAppUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}`.replace(/\/$/, "") : "https://flowsmartly.com";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid email address" } },
        { status: 400 },
      );
    }
    const { email } = validation.data;

    // Always report success to avoid email enumeration.
    const ok = NextResponse.json({
      success: true,
      data: { message: "If an account exists with that email, you'll get a reset link." },
    });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, deletedAt: true } });
    if (!user || user.deletedAt) return ok;

    // Rate-limit: one request per minute.
    const recent = await prisma.passwordReset.findFirst({
      where: { email, createdAt: { gte: new Date(Date.now() - 60 * 1000) }, usedAt: null },
    });
    if (recent) return ok;

    const token = nanoid(32);
    await prisma.passwordReset.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });
    await prisma.passwordReset.create({ data: { email, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });

    try {
      await notifyPasswordReset({ email: user.email, name: user.name, resetUrl: `${getAppUrl(request)}/reset-password?token=${encodeURIComponent(token)}` });
    } catch (mailError) {
      await prisma.passwordReset.update({ where: { token }, data: { usedAt: new Date() } }).catch(() => {});
      console.error("Mobile forgot-password email failed:", mailError);
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_SEND_FAILED", message: "Couldn't send the reset email right now. Try again shortly." } },
        { status: 502 },
      );
    }

    return ok;
  } catch (error) {
    console.error("Mobile forgot-password error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An error occurred. Please try again." } },
      { status: 500 },
    );
  }
}
