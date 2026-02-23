import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";

const createStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters").max(100),
  slug: z.string().optional(),
  description: z.string().max(1000).optional(),
  industry: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
  region: z.string().max(50).optional(),
  country: z.string().max(10).optional(),
});

/**
 * GET /api/ecommerce/store
 * Return user's store or { store: null, hasStore: false }.
 * Supports ?checkSlug=true&slug=xxx to check slug availability.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const checkSlug = searchParams.get("checkSlug");

    // Slug availability check
    if (checkSlug === "true") {
      const slug = searchParams.get("slug");
      if (!slug) {
        return NextResponse.json({
          success: true,
          data: { available: false, message: "Slug is required" },
        });
      }

      const existing = await prisma.store.findUnique({
        where: { slug },
        select: { id: true, userId: true },
      });

      // Available if no store has this slug, or the current user owns it
      const available = !existing || existing.userId === session.userId;

      return NextResponse.json({
        success: true,
        data: { available, slug },
      });
    }

    // Get user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
    });

    if (!store) {
      return NextResponse.json({
        success: true,
        data: { store: null, hasStore: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        store: {
          ...store,
          theme: JSON.parse(store.theme || "{}"),
          settings: JSON.parse(store.settings || "{}"),
        },
        hasStore: true,
      },
    });
  } catch (error) {
    console.error("Get store error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch store" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ecommerce/store
 * Create a new store. Only one per user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    // Check if user already has a store
    const existingStore = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (existingStore) {
      return NextResponse.json(
        { success: false, error: { code: "STORE_EXISTS", message: "You already have a store" } },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = createStoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Generate slug from name if not provided
    let slug = data.slug ? generateSlug(data.slug) : generateSlug(data.name);

    // Check slug uniqueness and append suffix if needed
    let slugExists = await prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (slugExists) {
      // Append random suffix
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${slug}-${suffix}`;

      slugExists = await prisma.store.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (slugExists) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
    }

    const store = await prisma.store.create({
      data: {
        userId: session.userId,
        name: data.name,
        slug,
        description: data.description || null,
        industry: data.industry || null,
        currency: data.currency || "USD",
        region: data.region || null,
        country: data.country || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        store: {
          ...store,
          theme: JSON.parse(store.theme || "{}"),
          settings: JSON.parse(store.settings || "{}"),
        },
      },
    });
  } catch (error) {
    console.error("Create store error:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_FAILED", message: "Failed to create store" } },
      { status: 500 }
    );
  }
}
