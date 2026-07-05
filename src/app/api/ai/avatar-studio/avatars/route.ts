import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listAvatarsForUser } from "@/lib/avatar-studio";

/** GET — avatars available to render with (HeyGen stock + the account's clones). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const avatars = await listAvatarsForUser();
  return NextResponse.json({ success: true, data: { avatars } });
}
