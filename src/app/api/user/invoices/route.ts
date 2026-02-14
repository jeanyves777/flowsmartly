import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserInvoices } from "@/lib/invoices";

// GET /api/user/invoices - Get user's invoices
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await getUserInvoices(session.userId, { limit, offset });

    return NextResponse.json({
      success: true,
      data: {
        invoices: result.invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          type: inv.type,
          status: inv.status,
          items: JSON.parse(inv.items),
          subtotalCents: inv.subtotalCents,
          totalCents: inv.totalCents,
          paymentMethod: inv.paymentMethod,
          currency: inv.currency,
          createdAt: inv.createdAt.toISOString(),
        })),
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch invoices" } },
      { status: 500 }
    );
  }
}
