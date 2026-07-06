import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listTemplatesForUser } from "@/lib/avatar-studio";

/** GET — the account's real HeyGen templates (background/music/captions/branding baked in). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const templates = await listTemplatesForUser();
  return NextResponse.json({ success: true, data: { templates } });
}
