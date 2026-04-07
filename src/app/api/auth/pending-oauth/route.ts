import { NextRequest, NextResponse } from "next/server";

/**
 * Returns pending OAuth data from cookie (set during OAuth register flow)
 */
export async function GET(request: NextRequest) {
  const pending = request.cookies.get("pending_oauth")?.value;

  if (!pending) {
    return NextResponse.json({ success: false, data: null });
  }

  try {
    const data = JSON.parse(pending);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, data: null });
  }
}
