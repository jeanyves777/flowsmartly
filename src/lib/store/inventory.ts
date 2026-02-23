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
 * Deduct inventory for order items within a Prisma transaction.
 * Call this inside a $transaction block.
 */
export async function deductInventory(
  items: OrderItem[],
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { trackInventory: true, quantity: true, name: true },
    });

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

  const items = JSON.parse(order.items) as OrderItem[];

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
