import { NextRequest, NextResponse } from "next/server";
import { validateReferralCode } from "@/lib/referrals";

// GET /api/referrals/check/[code] — Validate a referral code (public, no auth)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || code.length < 4) {
      return NextResponse.json(
        { success: true, data: { valid: false } },
        { status: 200 }
      );
    }

    const result = await validateReferralCode(code);

    if (!result) {
      return NextResponse.json(
        { success: true, data: { valid: false } },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        referrerName: result.referrerName,
        isAgent: result.isAgent,
      },
    });
  } catch (error) {
    console.error("Referral code validation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to validate code" } },
      { status: 500 }
    );
  }
}
