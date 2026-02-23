"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Loader2,
  AlertCircle,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCart } from "./cart-provider";
import { calculateShipping, formatCents } from "@/lib/store/cart";

interface CheckoutFormProps {
  storeSlug: string;
  storeName: string;
  currency: string;
  paymentMethods: Array<{ methodType: string; provider: string | null }>;
  shippingConfig: {
    flatRateCents?: number;
    freeShippingThresholdCents?: number;
    localPickup?: boolean;
  } | null;
  primaryColor: string;
  cancelled?: boolean;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Credit/Debit Card",
  cod: "Cash on Delivery",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
};

const PAYMENT_METHOD_ICONS: Record<string, typeof CreditCard> = {
  card: CreditCard,
  cod: Banknote,
  mobile_money: Smartphone,
  bank_transfer: Building,
};

export function CheckoutForm({
  storeSlug,
  storeName,
  currency,
  paymentMethods,
  shippingConfig,
  primaryColor,
  cancelled,
}: CheckoutFormProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const { items, subtotalCents, clearCart } = useCart();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [selectedPayment, setSelectedPayment] = useState(
    paymentMethods.length > 0 ? paymentMethods[0].methodType : ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shipping calculation
  const shippingCents = calculateShipping(subtotalCents, shippingConfig, shippingMethod);
  const totalCents = subtotalCents + shippingCents;

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Add some items to your cart before checking out.</p>
        <Link
          href={`/store/${storeSlug}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {storeName}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const selectedMethod = paymentMethods.find((m) => m.methodType === selectedPayment);

      const res = await fetch(`/api/store/${storeSlug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail: email,
          customerPhone: phone || undefined,
          shippingAddress: {
            street,
            city,
            state,
            zip,
            country,
          },
          shippingMethod,
          paymentMethod: selectedPayment,
          paymentProvider: selectedMethod?.provider || null,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId || undefined,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Something went wrong. Please try again.");
        return;
      }

      // Card payment: confirm payment inline with CardElement
      if (data.data?.clientSecret) {
        if (!stripe || !elements) {
          setError("Payment system not ready. Please refresh and try again.");
          return;
        }

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          setError("Card form not found. Please refresh and try again.");
          return;
        }

        const { error: stripeError } = await stripe.confirmCardPayment(
          data.data.clientSecret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: customerName,
                email,
              },
            },
          }
        );

        if (stripeError) {
          setError(stripeError.message || "Payment failed. Please try again.");
          return;
        }

        // Payment confirmed — redirect to confirmation
        clearCart();
        router.push(`/store/${storeSlug}/order-confirmation?orderId=${data.data.orderId}`);
        return;
      }

      // Non-card orders (COD, etc.): clear cart and redirect to confirmation
      if (data.data?.orderId) {
        clearCart();
        router.push(`/store/${storeSlug}/order-confirmation?orderId=${data.data.orderId}`);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href={`/store/${storeSlug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {storeName}
      </Link>

      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      {/* Cancelled banner */}
      {cancelled && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Your payment was cancelled. You can try again or choose a different payment method.</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: form fields */}
          <div className="lg:col-span-2 space-y-8">
            {/* Customer Info */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ ["--tw-ring-color" as string]: primaryColor }}
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: primaryColor }}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: primaryColor }}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Shipping Address */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="street"
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ ["--tw-ring-color" as string]: primaryColor }}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: primaryColor }}
                      placeholder="New York"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      State / Province <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="state"
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: primaryColor }}
                      placeholder="NY"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP / Postal Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="zip"
                      type="text"
                      required
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: primaryColor }}
                      placeholder="10001"
                    />
                  </div>
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="country"
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: primaryColor }}
                      placeholder="United States"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Shipping Method */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Shipping Method</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="standard"
                    checked={shippingMethod === "standard"}
                    onChange={(e) => setShippingMethod(e.target.value)}
                    className="accent-current"
                    style={{ accentColor: primaryColor }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Standard Shipping</span>
                    {shippingConfig?.flatRateCents ? (
                      <span className="text-sm text-gray-500 ml-2">
                        {shippingConfig.freeShippingThresholdCents &&
                        subtotalCents >= shippingConfig.freeShippingThresholdCents
                          ? "Free"
                          : formatCents(shippingConfig.flatRateCents, currency)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 ml-2">Free</span>
                    )}
                  </div>
                </label>

                {shippingConfig?.localPickup && (
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value="local_pickup"
                      checked={shippingMethod === "local_pickup"}
                      onChange={(e) => setShippingMethod(e.target.value)}
                      className="accent-current"
                      style={{ accentColor: primaryColor }}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">Local Pickup</span>
                      <span className="text-sm text-gray-500 ml-2">Free</span>
                    </div>
                  </label>
                )}
              </div>
            </section>

            {/* Payment Method */}
            {paymentMethods.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
                <div className="space-y-3">
                  {paymentMethods.map((method) => {
                    const Icon = PAYMENT_METHOD_ICONS[method.methodType] || CreditCard;
                    const label = PAYMENT_METHOD_LABELS[method.methodType] || method.methodType;
                    return (
                      <label
                        key={`${method.methodType}-${method.provider}`}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.methodType}
                          checked={selectedPayment === method.methodType}
                          onChange={(e) => setSelectedPayment(e.target.value)}
                          className="accent-current"
                          style={{ accentColor: primaryColor }}
                        />
                        <Icon className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    );
                  })}

                  {/* Inline card form when card is selected */}
                  {selectedPayment === "card" && (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-500" />
                        Card Details
                      </p>
                      <div className="p-3 border rounded-lg bg-white">
                        <CardElement
                          options={{
                            style: {
                              base: {
                                fontSize: "16px",
                                color: "#1a1a1a",
                                "::placeholder": { color: "#a3a3a3" },
                                fontFamily: "system-ui, -apple-system, sans-serif",
                              },
                              invalid: { color: "#ef4444" },
                            },
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Shield className="w-3.5 h-3.5 text-green-500" />
                        <span>Secured with 256-bit SSL encryption by Stripe</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right column: Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              {/* Cart items */}
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId || ""}`}
                    className="flex gap-3"
                  >
                    {item.imageUrl ? (
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.variantName && (
                        <p className="text-xs text-gray-500">{item.variantName}</p>
                      )}
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium whitespace-nowrap">
                      {formatCents(item.priceCents * item.quantity, currency)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCents(subtotalCents, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping</span>
                  <span>
                    {shippingCents === 0 ? "Free" : formatCents(shippingCents, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold border-t border-gray-200 pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatCents(totalCents, currency)}</span>
                </div>
              </div>

              {/* Place Order button */}
              <button
                type="submit"
                disabled={isSubmitting || paymentMethods.length === 0}
                className="w-full mt-6 rounded-lg px-6 py-3 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Place Order"
                )}
              </button>

              {paymentMethods.length === 0 && (
                <p className="text-xs text-red-500 text-center mt-2">
                  No payment methods available. Please contact the store owner.
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
