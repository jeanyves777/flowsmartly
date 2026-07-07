import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listVoicesForUser } from "@/lib/avatar-studio";

/** GET — voices available to speak the script (HeyGen stock + cloned voices). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const voices = await listVoicesForUser();
  return NextResponse.json(
    { success: true, data: { voices } },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
