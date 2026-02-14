import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET() {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { admin: session.admin },
    });
  } catch (error) {
    console.error("Admin me error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get session" } },
      { status: 500 }
    );
  }
}
