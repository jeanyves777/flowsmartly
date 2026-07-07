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
  // Server-side the list is already cached (catalog-cache); let the browser skip
  // the roundtrip entirely on quick re-opens too.
  return NextResponse.json(
    { success: true, data: { avatars } },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
