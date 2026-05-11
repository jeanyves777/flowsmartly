import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createRecoveryCodes, hashRecoveryCode, verifyTotpCode } from "@/lib/auth/totp";

const enableTwoFactorSchema = z.object({
  code: z.string().min(6),
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

    const parsed = enableTwoFactorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Enter the 6-digit authenticator code" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: { message: "Start two-factor setup before enabling it" } },
        { status: 400 }
      );
    }

    if (!verifyTotpCode(user.twoFactorSecret, parsed.data.code)) {
      return NextResponse.json(
        { success: false, error: { message: "That code did not match. Check your authenticator app and try again." } },
        { status: 400 }
      );
    }

    const recoveryCodes = createRecoveryCodes();
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: user.twoFactorEnabled ? undefined : new Date(),
        twoFactorRecoveryCodes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        enabled: true,
        recoveryCodes,
      },
    });
  } catch (error) {
    console.error("2FA enable error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to enable two-factor authentication" } },
      { status: 500 }
    );
  }
}
