import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readReelCampaignById, deleteReelCampaign, listPostsForCampaign } from "@/lib/reel/reel-editor";

// GET /api/reels/[id] — one campaign (with clips) + its publish records.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const campaign = await readReelCampaignById(id, session.userId);
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const posts = await listPostsForCampaign(id, session.userId);
    return NextResponse.json({ campaign, posts });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/reels/[id] — soft-delete a campaign.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await deleteReelCampaign(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
