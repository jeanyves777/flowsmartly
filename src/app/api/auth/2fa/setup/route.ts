import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createTotpUri, generateTotpSecret } from "@/lib/auth/totp";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: { message: "Two-factor authentication is already enabled" } },
        { status: 400 }
      );
    }

    const secret = generateTotpSecret();
    const otpauthUrl = createTotpUri({
      secret,
      accountName: user.email,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 224,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorSecret: secret,
        twoFactorRecoveryCodes: "[]",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        secret,
        otpauthUrl,
        qrCodeDataUrl,
      },
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to start two-factor setup" } },
      { status: 500 }
    );
  }
}
