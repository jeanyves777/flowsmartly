import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { sendTestEmail } from "@/lib/email";

// POST /api/admin/email-test - Send a test email
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: { message: "Email address is required" } },
        { status: 400 }
      );
    }

    const result = await sendTestEmail(email);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error || "Failed to send test email" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Test email sent successfully to ${email}`,
      },
    });
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to send test email" } },
      { status: 500 }
    );
  }
}
