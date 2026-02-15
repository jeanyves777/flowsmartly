import { NextResponse } from "next/server";
import { getAgentSessionInfo } from "@/lib/auth/session";

export async function GET() {
  try {
    const info = await getAgentSessionInfo();

    return NextResponse.json({
      success: true,
      data: info,
    });
  } catch (error) {
    console.error("Agent session status error:", error);
    return NextResponse.json({
      success: true,
      data: { isImpersonating: false },
    });
  }
}
