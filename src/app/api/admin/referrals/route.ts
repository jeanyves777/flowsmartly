import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import {
  getAdminReferralStats,
  getAdminReferrals,
  getAdminCommissions,
} from "@/lib/referrals";

// GET /api/admin/referrals — Get platform-wide referral data
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;

    const [stats, referrals, commissions] = await Promise.all([
      getAdminReferralStats(),
      getAdminReferrals({ page, limit, status, type }),
      getAdminCommissions({ page, limit }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        referrals: referrals.referrals,
        commissions: commissions.commissions,
        referralPagination: referrals.pagination,
        commissionPagination: commissions.pagination,
      },
    });
  } catch (error) {
    console.error("Admin referrals error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch referral data" } },
      { status: 500 }
    );
  }
}
