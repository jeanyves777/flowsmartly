import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { resolveTheme } from "@/lib/store/theme-utils";
import { CheckCircle, Package, Clock, ArrowRight } from "lucide-react";

interface OrderConfirmationProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; orderId?: string }>;
}

interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  priceCents: number;
  imageUrl?: string;
}

interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: OrderConfirmationProps) {
  const { slug } = await params;
  const { session_id, orderId } = await searchParams;

  // Must have at least one identifier
  if (!session_id && !orderId) {
    return notFound();
  }

  // Fetch store
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      theme: true,
      currency: true,
    },
  });

  if (!store || !store.isActive) {
    return notFound();
  }

  // Find order by session_id (Stripe) or orderId
  const order = session_id
    ? await prisma.order.findFirst({
        where: { storeId: store.id, paymentId: session_id },
      })
    : await prisma.order.findFirst({
        where: { id: orderId!, storeId: store.id },
      });

  if (!order) {
    return notFound();
  }

  const o = order;
  const theme = resolveTheme(store.theme);
  const primaryColor = theme.colors.primary;

  // Parse JSON fields
  const items: OrderItem[] = (() => {
    try {
      return JSON.parse(o.items || "[]");
    } catch {
      return [];
    }
  })();

  const shippingAddress: ShippingAddress = (() => {
    try {
      return JSON.parse(o.shippingAddress || "{}");
    } catch {
      return {};
    }
  })();

  function formatPrice(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: o.currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  const isPaid = o.paymentStatus === "paid";
  const isCOD = o.paymentMethod === "cod";

  return (
    <div className="min-h-[60vh] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
            <CheckCircle className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            Order Confirmed!
          </h1>
          <p className="mt-2 opacity-60">
            Thank you for your order, {o.customerName}.
          </p>
        </div>

        {/* Order Number */}
        <div
          className="rounded-xl p-4 text-center mb-8"
          style={{ backgroundColor: `${primaryColor}08`, border: `1px solid ${primaryColor}20` }}
        >
          <p className="text-sm opacity-60 mb-1">Order Number</p>
          <p className="text-lg font-bold" style={{ color: primaryColor }}>
            {o.orderNumber}
          </p>
        </div>

        {/* Order Summary */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{ border: `1px solid ${theme.colors.text}10` }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            Order Summary
          </h2>

          {/* Items */}
          <div className="space-y-3 mb-4">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="opacity-70">{item.name}</span>
                  {item.quantity > 1 && (
                    <span className="opacity-40">x{item.quantity}</span>
                  )}
                </div>
                <span className="font-medium">
                  {formatPrice(item.priceCents * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t my-4" style={{ borderColor: `${theme.colors.text}10` }} />

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="opacity-60">Subtotal</span>
              <span>{formatPrice(o.subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">Shipping</span>
              <span>{o.shippingCents > 0 ? formatPrice(o.shippingCents) : "Free"}</span>
            </div>
            {o.taxCents > 0 && (
              <div className="flex justify-between">
                <span className="opacity-60">Tax</span>
                <span>{formatPrice(o.taxCents)}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2" style={{ borderColor: `${theme.colors.text}10` }}>
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span style={{ color: primaryColor }}>{formatPrice(o.totalCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div
          className="rounded-xl p-4 mb-6"
          style={{ border: `1px solid ${theme.colors.text}10` }}
        >
          <div className="flex items-center gap-3">
            {isPaid ? (
              <>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-green-700">Payment confirmed</p>
                  <p className="text-xs opacity-50">
                    Paid via {o.paymentMethod === "card" ? "card" : o.paymentMethod || "online payment"}
                  </p>
                </div>
              </>
            ) : isCOD ? (
              <>
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-amber-700">Cash on Delivery</p>
                  <p className="text-xs opacity-50">
                    Please have {formatPrice(o.totalCents)} ready at delivery
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Payment pending</p>
                  <p className="text-xs opacity-50">
                    Your payment is being processed
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Shipping Address */}
        {(shippingAddress.line1 || shippingAddress.city) && (
          <div
            className="rounded-xl p-4 mb-6"
            style={{ border: `1px solid ${theme.colors.text}10` }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}10` }}>
                <Package className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="font-medium text-sm mb-1">Shipping Address</p>
                <div className="text-sm opacity-60 space-y-0.5">
                  {shippingAddress.name && <p>{shippingAddress.name}</p>}
                  {shippingAddress.line1 && <p>{shippingAddress.line1}</p>}
                  {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
                  <p>
                    {[shippingAddress.city, shippingAddress.state, shippingAddress.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {shippingAddress.country && <p>{shippingAddress.country}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* What Happens Next */}
        <div
          className="rounded-xl p-6 mb-8"
          style={{ backgroundColor: `${primaryColor}05`, border: `1px solid ${primaryColor}15` }}
        >
          <h3
            className="font-semibold text-sm mb-3"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            What happens next?
          </h3>
          {isCOD ? (
            <div className="space-y-2 text-sm opacity-70">
              <p>Your order is confirmed. Payment will be collected on delivery.</p>
              <p>We will send a confirmation email to <strong>{o.customerEmail}</strong> with your order details.</p>
              <p>You will receive updates as your order is prepared and shipped.</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm opacity-70">
              <p>Your order is being prepared and will be shipped soon.</p>
              <p>A confirmation email has been sent to <strong>{o.customerEmail}</strong>.</p>
              <p>You will receive tracking information once your order has shipped.</p>
            </div>
          )}
        </div>

        {/* Continue Shopping */}
        <div className="text-center">
          <Link
            href={`/store/${store.slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Continue Shopping
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
