import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sendTransactionalEmail } from "@/lib/email/transactional-sender";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, templateId, variables, contact } = body;

    if (!to || !templateId) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required fields: to, templateId" } },
        { status: 400 }
      );
    }

    const result = await sendTransactionalEmail({
      userId: session.userId,
      to,
      templateId,
      variables,
      contact,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Transactional email API error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
