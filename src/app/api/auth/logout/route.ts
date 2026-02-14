import { NextResponse } from "next/server";
import { getSession, clearSessionCookies, invalidateSession } from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      // Invalidate session in database
      await invalidateSession(session.sessionId);
    }

    // Clear cookies
    await clearSessionCookies();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    // Still clear cookies even if there's an error
    await clearSessionCookies();

    return NextResponse.json({
      success: true,
      message: "Logged out",
    });
  }
}
