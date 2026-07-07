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
  // No browser caching here: the server-side catalog cache already makes this
  // near-instant, and a just-uploaded clone must show on the very next fetch —
  // a stale browser copy would hide it (bustAvatarCatalog only fixes the server).
  return NextResponse.json(
    { success: true, data: { avatars } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
