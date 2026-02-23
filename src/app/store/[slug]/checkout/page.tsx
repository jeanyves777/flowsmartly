import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTheme } from "@/lib/store/theme-utils";
import { CheckoutForm } from "@/components/store/checkout-form";
import { StripeProvider } from "@/components/providers/stripe-provider";

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const { cancelled } = await searchParams;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      theme: true,
      currency: true,
      region: true,
      settings: true,
    },
  });

  if (!store || !store.isActive) {
    notFound();
  }

  // Fetch active payment methods for this store
  const paymentMethods = await prisma.storePaymentMethod.findMany({
    where: { storeId: store.id, isActive: true },
    select: { methodType: true, provider: true },
  });

  const theme = resolveTheme(store.theme);
  const primaryColor = theme.colors.primary;

  // Parse shipping config from store settings
  let shippingConfig: {
    flatRateCents?: number;
    freeShippingThresholdCents?: number;
    localPickup?: boolean;
  } | null = null;

  try {
    const settings = store.settings ? JSON.parse(store.settings as string) : {};
    if (settings.shipping) {
      shippingConfig = settings.shipping;
    }
  } catch {
    // Invalid settings JSON — no shipping config
  }

  return (
    <StripeProvider>
      <CheckoutForm
        storeSlug={store.slug}
        storeName={store.name}
        currency={store.currency}
        paymentMethods={paymentMethods}
        shippingConfig={shippingConfig}
        primaryColor={primaryColor}
        cancelled={cancelled === "true"}
      />
    </StripeProvider>
  );
}
