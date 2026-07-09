import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deliverProposal } from "@/lib/pitch/send-proposal";

// GET /api/pitch/[id]/pdf?variant=visual|deck - direct PDF download for
// inline agent cards. Uses the same renderer as Pitch Studio send/download.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const variantParam = request.nextUrl.searchParams.get("variant");
    const variant = variantParam === "visual" ? "visual" : variantParam === "deck" ? "deck" : undefined;
    const result = await deliverProposal(session.userId, id, { pdfOnly: true, variant });

    if (!result.ok || !result.pdf) {
      const status =
        result.code === "not_found" ? 404 :
        result.code === "not_ready" ? 400 : 500;
      return NextResponse.json({ success: false, error: { message: result.error || "Failed to generate PDF" } }, { status });
    }

    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename || "proposal.pdf"}"`,
        "Content-Length": String(result.pdf.length),
      },
    });
  } catch (error) {
    console.error("Download pitch PDF error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to download PDF" } }, { status: 500 });
  }
}
