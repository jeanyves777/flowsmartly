import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { consumeRecoveryCode, verifyTotpCode } from "@/lib/auth/totp";

const disableTwoFactorSchema = z.object({
  code: z.string().optional(),
  currentPassword: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const parsed = disableTwoFactorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid request" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json({ success: true, data: { enabled: false } });
    }

    const code = parsed.data.code?.trim() || "";
    const password = parsed.data.currentPassword || "";
    const validTotp = !!user.twoFactorSecret && !!code && verifyTotpCode(user.twoFactorSecret, code);
    const recoveryResult = code ? consumeRecoveryCode(user.twoFactorRecoveryCodes, code) : { valid: false };
    const validPassword =
      !!user.passwordHash && !!password
        ? await verifyPassword(password, user.passwordHash)
        : false;

    if (!validTotp && !recoveryResult.valid && !validPassword) {
      return NextResponse.json(
        { success: false, error: { message: "Enter a valid authenticator code, recovery code, or current password" } },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        twoFactorRecoveryCodes: "[]",
      },
    });

    return NextResponse.json({
      success: true,
      data: { enabled: false },
    });
  } catch (error) {
    console.error("2FA disable error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to disable two-factor authentication" } },
      { status: 500 }
    );
  }
}
