import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendAbandonedCartEmail } from "@/lib/email/commerce";

const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/store-abandoned-cart
// Sends retargeting emails to store customers with carts idle 2-48h
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const minAge = new Date(now.getTime() - 2 * 60 * 60 * 1000);   // 2h ago
  const maxAge = new Date(now.getTime() - 48 * 60 * 60 * 1000);  // 48h ago

  // Find cart items idle between 2h and 48h
  const cartItems = await prisma.storeCartItem.findMany({
    where: {
      savedForLater: false,
      updatedAt: { lte: minAge, gte: maxAge },
    },
    include: {
      customer: { select: { id: true, name: true, email: true, storeId: true } },
    },
  });

  if (cartItems.length === 0) {
    return NextResponse.json({ success: true, data: { checked: 0, emailsSent: 0 } });
  }

  // Group by storeId + customerId
  const grouped = new Map<string, typeof cartItems>();
  for (const item of cartItems) {
    const key = `${item.storeId}:${item.customerId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Skip customers who ordered in the last 48h (already converted)
  const recentOrderEmails = new Set(
    (await prisma.order.findMany({
      where: { createdAt: { gte: maxAge }, paymentStatus: "paid" },
      select: { customerEmail: true },
    })).map(o => o.customerEmail)
  );

  let emailsSent = 0;

  for (const [, items] of grouped) {
    const customer = items[0].customer;
    if (recentOrderEmails.has(customer.email)) continue;

    // Fetch store info
    const store = await prisma.store.findUnique({
      where: { id: customer.storeId },
      select: { name: true, slug: true, currency: true },
    });
    if (!store) continue;

    // Fetch product details for cart items
    const productIds = [...new Set(items.map(i => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, priceCents: true, images: true },
    });
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const emailItems = items.map(item => {
      const product = productMap[item.productId];
      let imageUrl: string | undefined;
      try {
        const imgs = JSON.parse(product?.images || "[]");
        imageUrl = imgs[0]?.url || imgs[0];
      } catch { /* ignore */ }
      return {
        name: product?.name || "Product",
        imageUrl,
        priceCents: product?.priceCents || 0,
        quantity: item.quantity,
      };
    });

    const storeUrl = `https://flowsmartly.com/stores/${store.slug}`;

    try {
      await sendAbandonedCartEmail({
        to: customer.email,
        customerName: customer.name,
        storeName: store.name,
        storeUrl,
        items: emailItems,
        currency: store.currency || "USD",
      });
      emailsSent++;
    } catch (err) {
      console.error(`Abandoned cart email failed for ${customer.email}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    data: { checked: grouped.size, emailsSent },
  });
}
