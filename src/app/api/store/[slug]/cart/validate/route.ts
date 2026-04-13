import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

// POST /api/store/[slug]/cart/validate
// Checks each cart item against DB: is it active? Is there enough stock?
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Verify store exists (lightweight check)
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (!store || !store.isActive) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const items: CartItem[] = Array.isArray(body.items) ? body.items : [];

    const issues: Array<{
      productId: string;
      name: string;
      issue: "unavailable" | "out_of_stock" | "insufficient_stock";
      available?: number;
    }> = [];

    for (const item of items) {
      if (!item.productId) continue;

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          trackInventory: true,
          quantity: true,
          variants: {
            where: item.variantId ? { id: item.variantId } : undefined,
            select: { id: true, name: true, quantity: true },
          },
        },
      });

      // Product doesn't exist, is inactive, or deleted
      if (!product || product.status !== "ACTIVE" || product.deletedAt) {
        issues.push({
          productId: item.productId,
          name: product?.name || "Unknown product",
          issue: "unavailable",
        });
        continue;
      }

      if (!product.trackInventory) continue;

      // Check variant stock if applicable
      if (item.variantId) {
        const variant = product.variants[0];
        if (!variant) {
          issues.push({ productId: item.productId, name: product.name, issue: "unavailable" });
        } else if (variant.quantity < item.quantity) {
          issues.push({
            productId: item.productId,
            name: `${product.name}${variant.name ? ` — ${variant.name}` : ""}`,
            issue: variant.quantity === 0 ? "out_of_stock" : "insufficient_stock",
            available: variant.quantity,
          });
        }
      } else if (product.quantity < item.quantity) {
        issues.push({
          productId: item.productId,
          name: product.name,
          issue: product.quantity === 0 ? "out_of_stock" : "insufficient_stock",
          available: product.quantity,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { valid: issues.length === 0, issues },
    });
  } catch (err) {
    console.error("Cart validate error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
