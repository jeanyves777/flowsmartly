"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function CardBrandIcon({ brand }: { brand: string }) {
  const colors: Record<string, string> = {
    visa: "#1a1f71",
    mastercard: "#eb001b",
    amex: "#007bc1",
    discover: "#e65c00",
  };
  const color = colors[brand] || "currentColor";
  return (
    <div
      className="flex items-center justify-center h-8 w-12 rounded border text-xs font-bold"
      style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)", color, fontSize: "10px" }}
    >
      {(BRAND_LABELS[brand] || brand).toUpperCase().slice(0, 4)}
    </div>
  );
}

// Inner form that uses Stripe hooks (must be inside <Elements>)
function AddCardForm({
  slug,
  onSuccess,
  onCancel,
}: {
  slug: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError("");
    setSaving(true);

    try {
      // Create SetupIntent on server
      const siRes = await fetch(`/api/store/${slug}/account/payment-methods/setup-intent`, {
        method: "POST",
      });
      if (!siRes.ok) {
        const d = await siRes.json();
        setError(d.error || "Failed to initialize card setup.");
        return;
      }
      const { clientSecret } = await siRes.json();

      // Confirm via Stripe.js
      const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! },
      });

      if (stripeError) {
        setError(stripeError.message || "Card setup failed.");
        return;
      }

      onSuccess();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const cardStyle = {
    style: {
      base: {
        fontSize: "14px",
        fontFamily: "inherit",
        color: "var(--store-text)",
        "::placeholder": { color: "rgba(128,128,128,0.6)" },
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5">Card Details</label>
        <div
          className="rounded-lg border px-3 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
            backgroundColor: "var(--store-input-bg, var(--store-background))",
          }}
        >
          <CardElement options={cardStyle} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !stripe}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          {saving ? "Saving..." : "Save Card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-5 py-2.5 text-sm font-medium opacity-60 hover:opacity-80 transition-opacity"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const fetchMethods = useCallback(async () => {
    try {
      const res = await fetch(`/api/store/${slug}/account/payment-methods`);
      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }
      const data = await res.json();
      setMethods(data.paymentMethods || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleSetDefault(pmId: string) {
    setActionId(pmId);
    try {
      const res = await fetch(`/api/store/${slug}/account/payment-methods/${pmId}`, { method: "POST" });
      if (res.status === 401) { router.push(`/store/${slug}/account/login`); return; }
      if (res.ok) {
        setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === pmId })));
        showToast("Default payment method updated.");
      }
    } catch { /* ignore */ } finally { setActionId(null); }
  }

  async function handleDelete(pmId: string) {
    if (!confirm("Remove this card?")) return;
    setActionId(pmId);
    try {
      const res = await fetch(`/api/store/${slug}/account/payment-methods/${pmId}`, { method: "DELETE" });
      if (res.status === 401) { router.push(`/store/${slug}/account/login`); return; }
      if (res.ok) {
        setMethods((prev) => prev.filter((m) => m.id !== pmId));
        showToast("Card removed.");
      }
    } catch { /* ignore */ } finally { setActionId(null); }
  }

  function handleAddSuccess() {
    setShowAdd(false);
    setLoading(true);
    fetchMethods();
    showToast("Card saved successfully.");
  }

  const borderStyle = { borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--store-primary)" }} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/store/${slug}/account`} className="opacity-50 hover:opacity-80 transition-opacity">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--store-font-heading), sans-serif" }}>
            Payment Methods
          </h1>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Add Card
          </button>
        )}
      </div>

      {/* Add Card Form */}
      {showAdd && (
        <div className="rounded-lg border p-5 mb-6" style={borderStyle}>
          <h2 className="text-lg font-semibold mb-4">Add New Card</h2>
          <Elements stripe={stripePromise}>
            <AddCardForm
              slug={slug}
              onSuccess={handleAddSuccess}
              onCancel={() => setShowAdd(false)}
            />
          </Elements>
        </div>
      )}

      {/* Card list */}
      {methods.length === 0 && !showAdd ? (
        <div className="rounded-lg border p-12 text-center" style={borderStyle}>
          <div className="h-12 w-12 mx-auto opacity-20 mb-4 flex items-center justify-center">
            <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
          <p className="text-lg font-medium opacity-60">No saved cards</p>
          <p className="text-sm opacity-40 mt-1">Add a card for faster checkout</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-block rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Add Your First Card
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((pm) => (
            <div key={pm.id} className="rounded-lg border p-4 flex items-center justify-between gap-4" style={borderStyle}>
              <div className="flex items-center gap-3">
                <CardBrandIcon brand={pm.brand} />
                <div>
                  <p className="text-sm font-medium">
                    {BRAND_LABELS[pm.brand] || pm.brand} ending in {pm.last4}
                    {pm.isDefault && (
                      <span
                        className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: "var(--store-primary)" }}
                      >
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs opacity-50">Expires {pm.expMonth.toString().padStart(2, "0")}/{pm.expYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {!pm.isDefault && (
                  <button
                    onClick={() => handleSetDefault(pm.id)}
                    disabled={actionId === pm.id}
                    className="text-xs font-medium hover:underline disabled:opacity-50"
                    style={{ color: "var(--store-primary)" }}
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(pm.id)}
                  disabled={actionId === pm.id}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs opacity-40 flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Card details are encrypted and stored securely by Stripe. We never store your card number.
      </p>
    </div>
  );
}
