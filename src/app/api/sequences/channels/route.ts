import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { channelConnected } from "@/lib/crm/sequence";

// GET /api/sequences/channels — which outreach channels are connected + ready to
// send for the current user (drives the Lead Studio automation channel chips).
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const [email, sms, whatsapp] = await Promise.all([
      channelConnected(session.userId, "email"),
      channelConnected(session.userId, "sms"),
      channelConnected(session.userId, "whatsapp"),
    ]);
    return NextResponse.json({ success: true, data: { email, sms, whatsapp } });
  } catch {
    return NextResponse.json({ success: false, error: { message: "Failed to load channels" } }, { status: 500 });
  }
}
