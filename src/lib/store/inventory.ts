/**
 * Inventory Management for FlowShop
 * Atomic inventory operations for order placement and cancellation.
 */

import { prisma } from "@/lib/db/client";

interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
}

/**
 * Validate that all items have sufficient inventory.
 * Returns null if OK, or error message if insufficient.
 */
export async function validateInventory(
  items: OrderItem[]
): Promise<string | null> {
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { name: true, trackInventory: true, quantity: true },
    });

    if (!product) {
      return `Product "${item.name}" not found`;
    }

    if (product.trackInventory && product.quantity < item.quantity) {
      return `Insufficient stock for "${product.name}". Available: ${product.quantity}, requested: ${item.quantity}`;
    }

    if (item.variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        select: { name: true, quantity: true },
      });

      if (!variant) {
        return `Variant not found for "${item.name}"`;
      }

      if (product.trackInventory && variant.quantity < item.quantity) {
        return `Insufficient stock for "${product.name} - ${variant.name}". Available: ${variant.quantity}, requested: ${item.quantity}`;
      }
    }
  }

  return null;
}

/**
 * Atomically validate and deduct inventory within a Prisma transaction.
 * Uses SELECT ... FOR UPDATE to lock rows and prevent overselling from concurrent orders.
 * Call this inside a $transaction block.
 */
export async function deductInventory(
  items: OrderItem[],
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  for (const item of items) {
    // Use raw query with FOR UPDATE to lock the row for this transaction
    // This prevents two concurrent checkouts from both reading the same quantity
    const products = await (tx as any).$queryRawUnsafe(
      `SELECT "id", "name", "trackInventory", "quantity" FROM "Product" WHERE "id" = $1 FOR UPDATE`,
      item.productId
    ) as Array<{ id: string; name: string; trackInventory: boolean; quantity: number }>;

    const product = products[0];
    if (!product || !product.trackInventory) continue;

    if (product.quantity < item.quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${product.quantity}, requested: ${item.quantity}`
      );
    }

    await tx.product.update({
      where: { id: item.productId },
      data: { quantity: { decrement: item.quantity } },
    });

    if (item.variantId) {
      const variants = await (tx as any).$queryRawUnsafe(
        `SELECT "id", "name", "quantity" FROM "ProductVariant" WHERE "id" = $1 FOR UPDATE`,
        item.variantId
      ) as Array<{ id: string; name: string; quantity: number }>;

      const variant = variants[0];
      if (variant && variant.quantity < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name} - ${variant.name}". Available: ${variant.quantity}, requested: ${item.quantity}`
        );
      }

      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { quantity: { decrement: item.quantity } },
      });
    }
  }
}

/**
 * Restore inventory when an order is cancelled.
 * Reads the order's items and increments quantities back.
 */
export async function restoreInventory(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { items: true },
  });

  if (!order) return;

  let items: OrderItem[] = [];
  try { items = JSON.parse(order.items); } catch { return; }

  for (const item of items) {
    if (!item.productId) continue;

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { trackInventory: true },
    });

    if (!product?.trackInventory) continue;

    await prisma.product
      .update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      })
      .catch(() => {});

    if (item.variantId) {
      await prisma.productVariant
        .update({
          where: { id: item.variantId },
          data: { quantity: { increment: item.quantity } },
        })
        .catch(() => {});
    }
  }
}
