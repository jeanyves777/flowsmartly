import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const paymentMethodSchema = z.object({
  methodType: z.string().min(1),
  provider: z.string().nullable(),
  isActive: z.boolean(),
});

const onboardingSchema = z.object({
  paymentMethods: z.array(paymentMethodSchema).min(1, "At least one payment method is required"),
  currency: z.string().max(10).optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * POST /api/ecommerce/onboarding
 * Complete store onboarding: create payment method records and mark setup as complete.
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

    // Verify user owns a store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, region: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "No store found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = onboardingSchema.safeParse(body);

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

    // ── Validate Brand Kit ──
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: { name: true, logo: true, iconLogo: true, colors: true, email: true },
    });

    if (!brandKit) {
      return NextResponse.json(
        { success: false, error: { code: "BRAND_KIT_REQUIRED", message: "Please set up your Brand Identity (name, logo, colors, email) before launching your store." } },
        { status: 400 }
      );
    }

    const bkColors = typeof brandKit.colors === "string" ? JSON.parse(brandKit.colors || "{}") : (brandKit.colors || {});
    if (!brandKit.name || !(brandKit.logo || brandKit.iconLogo) || !bkColors.primary || !brandKit.email) {
      return NextResponse.json(
        { success: false, error: { code: "BRAND_KIT_INCOMPLETE", message: "Your Brand Kit is incomplete. Please add your brand name, logo, primary color, and business email." } },
        { status: 400 }
      );
    }

    // ── Validate Email Config ──
    const marketingConfig = await prisma.marketingConfig.findFirst({
      where: { userId: session.userId },
      select: { emailProvider: true, emailVerified: true },
    });

    if (!marketingConfig || !marketingConfig.emailProvider || marketingConfig.emailProvider === "NONE" || !marketingConfig.emailVerified) {
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_CONFIG_REQUIRED", message: "Please configure and verify your email provider (SMTP, SendGrid, etc.) before launching. This ensures order emails come from your domain, not ours." } },
        { status: 400 }
      );
    }

    // Delete existing payment methods for this store (re-onboarding scenario)
    await prisma.storePaymentMethod.deleteMany({
      where: { storeId: store.id },
    });

    // Create StorePaymentMethod records for each enabled payment method
    const activePaymentMethods = data.paymentMethods.filter((pm) => pm.isActive);

    if (activePaymentMethods.length > 0) {
      await prisma.storePaymentMethod.createMany({
        data: activePaymentMethods.map((pm) => ({
          storeId: store.id,
          methodType: pm.methodType,
          provider: pm.provider,
          isActive: true,
          region: store.region,
        })),
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      setupComplete: true,
    };

    if (data.currency) {
      updateData.currency = data.currency;
    }

    if (data.settings) {
      updateData.settings = JSON.stringify(data.settings);
    }

    // Mark store as setup complete
    const updatedStore = await prisma.store.update({
      where: { id: store.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        store: {
          ...updatedStore,
          theme: JSON.parse(updatedStore.theme || "{}"),
          settings: JSON.parse(updatedStore.settings || "{}"),
        },
        paymentMethodsCount: activePaymentMethods.length,
      },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { success: false, error: { code: "ONBOARDING_FAILED", message: "Failed to complete onboarding" } },
      { status: 500 }
    );
  }
}
