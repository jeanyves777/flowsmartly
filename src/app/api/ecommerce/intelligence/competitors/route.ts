import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import {
  addCompetitorPrice,
  updateCompetitorPrice,
  deleteCompetitorPrice,
  getCompetitorPrices,
  analyzePricePosition,
} from "@/lib/store/competitor-pricing";

// ── GET /api/ecommerce/intelligence/competitors ──

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
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "productId is required" } },
        { status: 400 }
      );
    }

    // Validate product belongs to this store
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    const [competitors, analysis] = await Promise.all([
      getCompetitorPrices(productId),
      analyzePricePosition(productId),
    ]);

    return NextResponse.json({
      success: true,
      data: { competitors, analysis },
    });
  } catch (error) {
    console.error("Get competitor prices error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get competitor prices" } },
      { status: 500 }
    );
  }
}

// ── POST /api/ecommerce/intelligence/competitors ──

const addCompetitorSchema = z.object({
  productId: z.string().min(1),
  competitorName: z.string().min(1).max(200),
  competitorUrl: z.string().url().optional(),
  priceCents: z.number().int().positive(),
  inStock: z.boolean().optional(),
});

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
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = addCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const competitor = await addCompetitorPrice(store.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: { competitor },
    }, { status: 201 });
  } catch (error) {
    console.error("Add competitor price error:", error);
    const message = error instanceof Error ? error.message : "Failed to add competitor price";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// ── PUT /api/ecommerce/intelligence/competitors ──

const updateCompetitorSchema = z.object({
  id: z.string().min(1),
  competitorName: z.string().min(1).max(200).optional(),
  competitorUrl: z.string().url().optional().nullable(),
  priceCents: z.number().int().positive().optional(),
  inStock: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
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
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { id, competitorUrl, ...rest } = parsed.data;
    const competitor = await updateCompetitorPrice(id, store.id, {
      ...rest,
      competitorUrl: competitorUrl ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { competitor },
    });
  } catch (error) {
    console.error("Update competitor price error:", error);
    const message = error instanceof Error ? error.message : "Failed to update competitor price";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/ecommerce/intelligence/competitors ──

export async function DELETE(request: NextRequest) {
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
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "id is required" } },
        { status: 400 }
      );
    }

    await deleteCompetitorPrice(id, store.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete competitor price error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete competitor price";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
