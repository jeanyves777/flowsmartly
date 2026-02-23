import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import { z } from "zod";

// ── Validation Schema ──

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional().default(""),
  position: z.number().int().min(0).optional().default(0),
});

const variantUpdateSchema = z.object({
  id: z.string().optional(), // existing variant ID for update
  name: z.string().min(1),
  sku: z.string().optional(),
  priceCents: z.number().int().positive(),
  comparePriceCents: z.number().int().positive().optional().nullable(),
  options: z.record(z.string()).optional(),
  quantity: z.number().int().min(0).optional().default(0),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().max(160).optional().nullable(),
  category: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  priceCents: z.number().int().positive().optional(),
  comparePriceCents: z.number().int().positive().optional().nullable(),
  costCents: z.number().int().min(0).optional().nullable(),
  images: z.array(imageSchema).optional(),
  trackInventory: z.boolean().optional(),
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  variants: z.array(variantUpdateSchema).optional(),
});

// ── Helper: validate ownership ──

async function getOwnedProduct(userId: string, productId: string) {
  const store = await prisma.store.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!store) return { store: null, product: null };

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: store.id, deletedAt: null },
    include: {
      variants: true,
      productCategory: { select: { id: true, name: true } },
    },
  });

  return { store, product };
}

// ── GET /api/ecommerce/products/[id] ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { product } = await getOwnedProduct(session.userId, id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        images: JSON.parse(product.images || "[]"),
        tags: JSON.parse(product.tags || "[]"),
        variants: product.variants.map((v) => ({
          ...v,
          options: JSON.parse(v.options || "{}"),
        })),
      },
    });
  } catch (error) {
    console.error("Get product error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get product" } },
      { status: 500 }
    );
  }
}

// ── PATCH /api/ecommerce/products/[id] ──

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { store, product } = await getOwnedProduct(session.userId, id);

    if (!store || !product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Handle slug update if name changed
    let newSlug: string | undefined;
    if (data.name && data.name !== product.name) {
      newSlug = generateSlug(data.name);
      let slugSuffix = 1;
      while (true) {
        const existing = await prisma.product.findUnique({
          where: { storeId_slug: { storeId: store.id, slug: newSlug! } },
          select: { id: true },
        });
        if (!existing || existing.id === product.id) break;
        slugSuffix++;
        newSlug = `${generateSlug(data.name)}-${slugSuffix}`;
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (newSlug) updateData.slug = newSlug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
    if (data.comparePriceCents !== undefined) updateData.comparePriceCents = data.comparePriceCents;
    if (data.costCents !== undefined) updateData.costCents = data.costCents;
    if (data.images !== undefined) updateData.images = JSON.stringify(data.images);
    if (data.trackInventory !== undefined) updateData.trackInventory = data.trackInventory;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;

    const updated = await prisma.$transaction(async (tx) => {
      // Update product
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: updateData,
      });

      // Handle variants upsert if provided
      if (data.variants) {
        const existingVariantIds = product.variants.map((v) => v.id);
        const incomingVariantIds = data.variants.filter((v) => v.id).map((v) => v.id!);

        // Delete variants that are no longer in the list
        const toDelete = existingVariantIds.filter((id) => !incomingVariantIds.includes(id));
        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({
            where: { id: { in: toDelete }, productId: product.id },
          });
        }

        // Upsert each variant
        for (const variant of data.variants) {
          if (variant.id && existingVariantIds.includes(variant.id)) {
            // Update existing variant
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                sku: variant.sku,
                priceCents: variant.priceCents,
                comparePriceCents: variant.comparePriceCents,
                options: JSON.stringify(variant.options || {}),
                quantity: variant.quantity || 0,
                imageUrl: variant.imageUrl,
                isActive: variant.isActive ?? true,
              },
            });
          } else {
            // Create new variant
            await tx.productVariant.create({
              data: {
                productId: product.id,
                name: variant.name,
                sku: variant.sku,
                priceCents: variant.priceCents,
                comparePriceCents: variant.comparePriceCents,
                options: JSON.stringify(variant.options || {}),
                quantity: variant.quantity || 0,
                imageUrl: variant.imageUrl,
                isActive: variant.isActive ?? true,
              },
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id: updatedProduct.id },
        include: {
          variants: true,
          productCategory: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        images: JSON.parse(updated?.images || "[]"),
        tags: JSON.parse(updated?.tags || "[]"),
        variants: updated?.variants.map((v) => ({
          ...v,
          options: JSON.parse(v.options || "{}"),
        })),
      },
    });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update product" } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/ecommerce/products/[id] ──

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { store, product } = await getOwnedProduct(session.userId, id);

    if (!store || !product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete product
      await tx.product.update({
        where: { id: product.id },
        data: { deletedAt: new Date() },
      });

      // Decrement store product count
      await tx.store.update({
        where: { id: store.id },
        data: { productCount: { decrement: 1 } },
      });
    });

    return NextResponse.json({ success: true, data: { id: product.id } });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete product" } },
      { status: 500 }
    );
  }
}
