import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTheme } from "@/lib/store/theme-utils";
import { CheckoutForm } from "@/components/store/checkout-form";
import { StripeProvider } from "@/components/providers/stripe-provider";
import { getStoreCustomer } from "@/lib/store/customer-auth";

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string; cart?: string }>;
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const { cancelled, cart: cartParam } = await searchParams;

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

  // Pre-fill customer info if logged in
  let customerPrefill: { name?: string; email?: string; phone?: string; address?: Record<string, string> } | undefined;
  try {
    const customer = await getStoreCustomer(store.id);
    if (customer) {
      const addresses = JSON.parse(customer.addresses || "[]");
      const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0];
      customerPrefill = {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || undefined,
        address: defaultAddr || undefined,
      };
    }
  } catch {}

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
        cartData={cartParam || undefined}
        customerPrefill={customerPrefill}
      />
    </StripeProvider>
  );
}
