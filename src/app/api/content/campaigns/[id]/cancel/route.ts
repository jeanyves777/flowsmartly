import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cancelContentCampaign } from "@/lib/content/campaign-cancel";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id } = await params;
  const result = await cancelContentCampaign(id, session.userId);
  return NextResponse.json({ success: true, data: result });
}
