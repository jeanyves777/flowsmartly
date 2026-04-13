import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";

// GET /api/ecommerce/customers
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const store = await prisma.store.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "No store found" }, { status: 404 });

    const search = req.nextUrl.searchParams.get("search") || "";
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

    const where = {
      storeId: store.id,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.storeCustomer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      }),
      prisma.storeCustomer.count({ where }),
    ]);

    // Get order stats per customer email
    const emails = customers.map(c => c.email);
    const orderStats = await prisma.order.groupBy({
      by: ["customerEmail"],
      where: { storeId: store.id, customerEmail: { in: emails }, paymentStatus: "paid" },
      _count: { id: true },
      _sum: { totalCents: true },
      _max: { createdAt: true },
    });

    const statsMap = Object.fromEntries(
      orderStats.map(s => [s.customerEmail, s])
    );

    return NextResponse.json({
      success: true,
      data: {
        customers: customers.map(c => ({
          ...c,
          orderCount: statsMap[c.email]?._count?.id ?? 0,
          totalSpentCents: statsMap[c.email]?._sum?.totalCents ?? 0,
          lastOrderAt: statsMap[c.email]?._max?.createdAt ?? null,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Ecommerce customers error:", err);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}
