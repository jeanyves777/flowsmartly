import { NextResponse } from "next/server";
import { adminLogout } from "@/lib/admin/auth";

export async function POST() {
  try {
    await adminLogout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Logout failed" } },
      { status: 500 }
    );
  }
}
