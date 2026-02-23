import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import { z } from "zod";

// ── Validation Schema ──

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

// ── Helper: validate ownership ──

async function getOwnedCategory(userId: string, categoryId: string) {
  const store = await prisma.store.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!store) return { store: null, category: null };

  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, storeId: store.id },
    include: {
      children: { select: { id: true } },
      _count: { select: { products: true } },
    },
  });

  return { store, category };
}

// ── PATCH /api/ecommerce/categories/[id] ──

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
    const { store, category } = await getOwnedCategory(session.userId, id);

    if (!store || !category) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Category not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Prevent setting self as parent
    if (data.parentId && data.parentId === category.id) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PARENT", message: "A category cannot be its own parent" } },
        { status: 400 }
      );
    }

    // Validate parent exists if provided
    if (data.parentId) {
      const parent = await prisma.productCategory.findFirst({
        where: { id: data.parentId, storeId: store.id },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_PARENT", message: "Parent category not found" } },
          { status: 400 }
        );
      }
    }

    // Handle slug update if name changed
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
      let slug = generateSlug(data.name);
      let slugSuffix = 1;
      while (true) {
        const existing = await prisma.productCategory.findUnique({
          where: { storeId_slug: { storeId: store.id, slug } },
          select: { id: true },
        });
        if (!existing || existing.id === category.id) break;
        slugSuffix++;
        slug = `${generateSlug(data.name)}-${slugSuffix}`;
      }
      updateData.slug = slug;
    }

    if (data.description !== undefined) updateData.description = data.description;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const updated = await prisma.productCategory.update({
      where: { id: category.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update category" } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/ecommerce/categories/[id] ──

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
    const { store, category } = await getOwnedCategory(session.userId, id);

    if (!store || !category) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Category not found" } },
        { status: 404 }
      );
    }

    // Check for child categories
    if (category.children.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "HAS_CHILDREN", message: "Cannot delete category with child categories. Delete or reassign children first." } },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Set products with this categoryId to null
      await tx.product.updateMany({
        where: { categoryId: category.id, storeId: store.id },
        data: { categoryId: null },
      });

      // Delete the category
      await tx.productCategory.delete({
        where: { id: category.id },
      });
    });

    return NextResponse.json({ success: true, data: { id: category.id } });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete category" } },
      { status: 500 }
    );
  }
}
