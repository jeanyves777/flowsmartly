import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getUserReferralCode,
  buildReferralLink,
  getMyReferralStats,
  getMyReferrals,
  getMyCommissions,
} from "@/lib/referrals";

// GET /api/referrals — Get user's referral dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get referral code (creates one if doesn't exist)
    const code = await getUserReferralCode(session.userId);
    const link = buildReferralLink(code);

    // Fetch all data in parallel
    const [stats, referrals, commissions] = await Promise.all([
      getMyReferralStats(session.userId),
      getMyReferrals(session.userId, page, limit),
      getMyCommissions(session.userId, page, limit),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        code,
        link,
        stats,
        referrals: referrals.referrals,
        commissions: commissions.commissions,
        pagination: referrals.pagination,
      },
    });
  } catch (error) {
    console.error("Get referrals error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch referral data" } },
      { status: 500 }
    );
  }
}

// POST /api/referrals — Generate/get referral code
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const code = await getUserReferralCode(session.userId);
    const link = buildReferralLink(code);

    return NextResponse.json({
      success: true,
      data: { code, link },
    });
  } catch (error) {
    console.error("Generate referral code error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate referral code" } },
      { status: 500 }
    );
  }
}
