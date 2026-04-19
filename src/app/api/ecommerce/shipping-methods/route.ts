import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  priceCents: z.number().int().min(0),
  estimatedDays: z.string().max(50).optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

/** GET — list all shipping methods for the user's store */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ success: false, error: "No store" }, { status: 404 });

    const methods = await prisma.storeShippingMethod.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: { methods } });
  } catch (err) {
    console.error("GET shipping methods error:", err);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/** POST — create a new shipping method */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ success: false, error: "No store" }, { status: 404 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }

    const method = await prisma.storeShippingMethod.create({
      data: { storeId: store.id, ...parsed.data },
    });

    // Mark the store as having pending changes (user will publish when ready)
    const { markStoreAsPending } = await import("@/lib/store-builder/pending-changes");
    markStoreAsPending(store.id).catch(() => {});

    return NextResponse.json({ success: true, data: method }, { status: 201 });
  } catch (err) {
    console.error("POST shipping method error:", err);
    return NextResponse.json({ success: false, error: "Failed to create" }, { status: 500 });
  }
}
