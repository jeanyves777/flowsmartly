import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import {
  resendRegistrantVerificationEmail,
  syncRegistrantVerificationStatus,
} from "@/lib/domains/registrant-verification";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const status = await syncRegistrantVerificationStatus(id);
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("Admin registrant verification status error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to check registrant verification" } },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const result = await resendRegistrantVerificationEmail(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Admin registrant verification resend error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to resend registrant verification" } },
      { status: 500 }
    );
  }
}
