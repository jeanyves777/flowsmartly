import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cancelContentAutomation } from "@/lib/content/campaign-cancel";

interface Params {
  params: Promise<{ id: string; autoId: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { autoId } = await params;
  const result = await cancelContentAutomation(autoId, session.userId);
  return NextResponse.json({ success: true, data: result });
}
