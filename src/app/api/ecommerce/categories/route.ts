import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import { z } from "zod";

// ── Validation Schema ──

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

// ── Types ──

interface CategoryWithChildren {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  productCount: number;
  children: CategoryWithChildren[];
}

// ── GET /api/ecommerce/categories ──

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "Store not found" } },
        { status: 404 }
      );
    }

    const categories = await prisma.productCategory.findMany({
      where: { storeId: store.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true } },
      },
    });

    // Build tree structure
    const categoryMap = new Map<string, CategoryWithChildren>();
    const roots: CategoryWithChildren[] = [];

    // First pass: create all nodes
    for (const cat of categories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        parentId: cat.parentId,
        sortOrder: cat.sortOrder,
        productCount: cat._count.products,
        children: [],
      });
    }

    // Second pass: build hierarchy
    for (const cat of categories) {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return NextResponse.json({
      success: true,
      data: { categories: roots },
    });
  } catch (error) {
    console.error("List categories error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list categories" } },
      { status: 500 }
    );
  }
}

// ── POST /api/ecommerce/categories ──

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "Store not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const data = parsed.data;

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

    // Generate unique slug
    let slug = generateSlug(data.name);
    let slugSuffix = 1;
    while (true) {
      const existing = await prisma.productCategory.findUnique({
        where: { storeId_slug: { storeId: store.id, slug } },
        select: { id: true },
      });
      if (!existing) break;
      slugSuffix++;
      slug = `${generateSlug(data.name)}-${slugSuffix}`;
    }

    const category = await prisma.productCategory.create({
      data: {
        storeId: store.id,
        name: data.name,
        slug,
        description: data.description,
        imageUrl: data.imageUrl,
        parentId: data.parentId,
        sortOrder: data.sortOrder,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
    }, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create category" } },
      { status: 500 }
    );
  }
}
