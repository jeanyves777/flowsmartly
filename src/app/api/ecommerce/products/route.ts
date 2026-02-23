import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import { z } from "zod";

// ── Validation Schemas ──

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional().default(""),
  position: z.number().int().min(0).optional().default(0),
});

const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  priceCents: z.number().int().positive(),
  comparePriceCents: z.number().int().positive().optional(),
  options: z.record(z.string()).optional(),
  quantity: z.number().int().min(0).optional().default(0),
  imageUrl: z.string().url().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  shortDescription: z.string().max(160).optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priceCents: z.number().int().positive(),
  comparePriceCents: z.number().int().positive().optional(),
  costCents: z.number().int().min(0).optional(),
  images: z.array(imageSchema).optional(),
  trackInventory: z.boolean().optional().default(false),
  quantity: z.number().int().min(0).optional().default(0),
  lowStockThreshold: z.number().int().min(0).optional().default(5),
  status: z.enum(["DRAFT", "ACTIVE"]).optional().default("DRAFT"),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  variants: z.array(variantSchema).optional(),
});

// ── GET /api/ecommerce/products ──

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const sort = searchParams.get("sort") || "createdAt_desc";

    // Build where clause
    const where: Record<string, unknown> = {
      storeId: store.id,
      deletedAt: null,
    };

    if (status && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    // Build orderBy
    let orderBy: Record<string, string> = { createdAt: "desc" };
    switch (sort) {
      case "priceCents_asc":
        orderBy = { priceCents: "asc" };
        break;
      case "priceCents_desc":
        orderBy = { priceCents: "desc" };
        break;
      case "name_asc":
        orderBy = { name: "asc" };
        break;
      case "createdAt_desc":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { variants: true } },
          productCategory: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        products: products.map((p) => ({
          ...p,
          images: JSON.parse(p.images || "[]"),
          tags: JSON.parse(p.tags || "[]"),
          variantCount: p._count.variants,
          categoryName: p.productCategory?.name || null,
          _count: undefined,
          productCategory: undefined,
        })),
        total,
        page,
        totalPages,
      },
    });
  } catch (error) {
    console.error("List products error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list products" } },
      { status: 500 }
    );
  }
}

// ── POST /api/ecommerce/products ──

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
        { success: false, error: { code: "NO_STORE", message: "Store not found. Please set up your store first." } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate unique slug
    let slug = generateSlug(data.name);
    let slugSuffix = 1;
    while (true) {
      const existing = await prisma.product.findUnique({
        where: { storeId_slug: { storeId: store.id, slug } },
        select: { id: true },
      });
      if (!existing) break;
      slugSuffix++;
      slug = `${generateSlug(data.name)}-${slugSuffix}`;
    }

    // Create product + variants in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          storeId: store.id,
          name: data.name,
          slug,
          description: data.description,
          shortDescription: data.shortDescription,
          category: data.category,
          categoryId: data.categoryId,
          tags: JSON.stringify(data.tags || []),
          priceCents: data.priceCents,
          comparePriceCents: data.comparePriceCents,
          costCents: data.costCents,
          images: JSON.stringify(data.images || []),
          trackInventory: data.trackInventory,
          quantity: data.quantity,
          lowStockThreshold: data.lowStockThreshold,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
        },
      });

      // Create variants if provided
      if (data.variants && data.variants.length > 0) {
        await tx.productVariant.createMany({
          data: data.variants.map((v) => ({
            productId: created.id,
            name: v.name,
            sku: v.sku,
            priceCents: v.priceCents,
            comparePriceCents: v.comparePriceCents,
            options: JSON.stringify(v.options || {}),
            quantity: v.quantity || 0,
            imageUrl: v.imageUrl,
          })),
        });
      }

      // Increment store product count
      await tx.store.update({
        where: { id: store.id },
        data: { productCount: { increment: 1 } },
      });

      // Return product with variants
      return tx.product.findUnique({
        where: { id: created.id },
        include: { variants: true, productCategory: { select: { id: true, name: true } } },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        images: JSON.parse(product?.images || "[]"),
        tags: JSON.parse(product?.tags || "[]"),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create product" } },
      { status: 500 }
    );
  }
}
