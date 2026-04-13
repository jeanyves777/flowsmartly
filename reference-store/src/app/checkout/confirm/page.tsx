"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { motion } from "framer-motion";
import { Check, CreditCard, Lock, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { clearCart } from "@/lib/cart";
import { formatPrice } from "@/lib/data";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

// ─── Inner payment form (must live inside <Elements>) ────────────────────────

function PaymentForm({ orderId, amount }: { orderId: string; amount?: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const storeSlug = window.location.pathname.match(/\/stores\/([^/]+)/)?.[1] || "";
    const storeBase = storeSlug ? `/stores/${storeSlug}` : "";

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}${storeBase}/products`,
      },
    });

    if (stripeError) {
      setError(stripeError.message || "Payment failed. Please check your card details and try again.");
      setLoading(false);
    } else if (paymentIntent?.status === "succeeded") {
      clearCart();
      setSuccess(true);
    } else {
      setError("Payment could not be confirmed. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Your order has been confirmed. Check your email for details.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25"
        >
          Continue Shopping
        </Link>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl overflow-hidden">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe || !elements}
        className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-full font-semibold text-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary-600/25"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Lock size={20} />}
        {loading
          ? "Processing Payment..."
          : amount
          ? `Pay ${formatPrice(amount)}`
          : "Pay Now"}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <Lock size={12} /> SSL Encrypted
        </span>
        <span>Powered by Stripe</span>
        <span>Visa · Mastercard · Amex</span>
      </div>
    </form>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function ConfirmPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setClientSecret(params.get("secret"));
    setOrderId(params.get("order"));
    const amt = params.get("amount");
    if (amt) setAmount(parseInt(amt, 10));
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!clientSecret || !orderId || !stripePromise) {
    return (
      <>
        <Header onCartOpen={() => {}} />
        <main className="min-h-screen flex items-center justify-center px-4 pt-24">
          <div className="text-center max-w-sm">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Session Expired
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Please return to the shop and try again.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Shop
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const appearance = {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#6366f1",
      borderRadius: "12px",
      fontFamily: "inherit",
    },
  };

  return (
    <>
      <Header onCartOpen={() => {}} />
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-24 pb-16">
        <div className="max-w-xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Complete Payment</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your order is reserved — enter your payment details to confirm
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <PaymentForm orderId={orderId} amount={amount} />
            </Elements>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
