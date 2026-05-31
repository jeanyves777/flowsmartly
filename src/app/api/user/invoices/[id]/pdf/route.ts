import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

// GET /api/user/invoices/[id]/pdf — branded PDF download
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: { message: "Invoice not found" } },
        { status: 404 }
      );
    }

    if (invoice.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Forbidden" } },
        { status: 403 }
      );
    }

    const pdf = await renderInvoicePdf(invoice, invoice.user);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    console.error("Invoice PDF error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate invoice PDF" } },
      { status: 500 }
    );
  }
}
