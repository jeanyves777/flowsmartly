import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deliverProposal } from "@/lib/pitch/send-proposal";

// POST /api/pitch/[id]/send — email the branded proposal (PDF attached) or, with
// { pdfOnly: true }, return the PDF binary for download. The heavy lifting lives
// in deliverProposal() so the UI and the send_proposal agent tool share one code
// path (identical branded PDF rendered from the same HTML as the Pitch Studio).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { recipientEmail, recipientName, message, pdfOnly, variant } = body as {
      recipientEmail?: string; recipientName?: string; message?: string; pdfOnly?: boolean; variant?: "deck" | "visual";
    };

    const result = await deliverProposal(session.userId, id, { recipientEmail, recipientName, message, pdfOnly, variant });

    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404 :
        result.code === "not_ready" || result.code === "no_recipient" ? 400 : 500;
      return NextResponse.json({ success: false, error: { message: result.error || "Failed to send" } }, { status });
    }

    if (pdfOnly && result.pdf) {
      return new NextResponse(new Uint8Array(result.pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Content-Length": String(result.pdf.length),
        },
      });
    }

    return NextResponse.json({ success: true, data: { sentTo: result.sentTo, sentAt: new Date().toISOString() } });
  } catch (error) {
    console.error("Send pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to send pitch" } }, { status: 500 });
  }
}
