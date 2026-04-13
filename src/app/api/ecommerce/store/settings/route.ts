import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { isValidCurrency } from "@/lib/store/currency";

const updateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  bannerUrl: z.string().max(500).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  currency: z.string().max(10).optional(),
  theme: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/ecommerce/store/settings
 * Update store settings. User must own the store.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    // Verify user owns a store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "No store found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateSettingsSchema.safeParse(body);

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
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.currency !== undefined) {
      if (!isValidCurrency(data.currency)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid currency code" } },
          { status: 400 }
        );
      }
      updateData.currency = data.currency.toUpperCase();
    }
    if (data.theme !== undefined) updateData.theme = JSON.stringify(data.theme);
    if (data.settings !== undefined) {
      updateData.settings = JSON.stringify(data.settings);
      // Sync shipping settings to dedicated DB columns for store data.ts
      const shipping = (data.settings as Record<string, unknown>)?.shipping as Record<string, unknown> | undefined;
      if (shipping) {
        if (typeof shipping.flatRateCents === "number") updateData.flatRateShippingCents = shipping.flatRateCents;
        if (typeof shipping.freeShippingThresholdCents === "number") updateData.freeShippingThresholdCents = shipping.freeShippingThresholdCents;
      }
    }

    const updatedStore = await prisma.store.update({
      where: { id: store.id },
      data: updateData,
    });

    // Trigger store rebuild so shipping values sync to data.ts
    if (data.settings !== undefined) {
      const { triggerStoreRebuildIfV2 } = await import("@/lib/store-builder/product-sync");
      triggerStoreRebuildIfV2(store.id).catch(e => console.error("Settings sync error:", e));
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        store: {
          ...updatedStore,
          theme: JSON.parse(updatedStore.theme || "{}"),
          settings: JSON.parse(updatedStore.settings || "{}"),
        },
      }),
    });
  } catch (error) {
    console.error("Update store settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update store settings" } },
      { status: 500 }
    );
  }
}
