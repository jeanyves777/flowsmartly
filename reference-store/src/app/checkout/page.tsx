"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CreditCard, Truck, MapPin, ShoppingBag, Loader2 } from "lucide-react";
import { getCart, getCartTotal, clearCart } from "@/lib/cart";
import { formatPrice, storeInfo, shippingMethods } from "@/lib/data";
import type { CartItem } from "@/lib/cart";

const API_BASE = "https://flowsmartly.com";
const STORE_SLUG = (() => {
  if (typeof window === "undefined") return "";
  try { return window.location.pathname.match(/\/stores\/([^/]+)/)?.[1] || ""; } catch { return ""; }
})();

const STEPS = [
  { id: "info", label: "Info", icon: MapPin },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payment", label: "Payment", icon: CreditCard },
];

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    shippingMethodId: "",
    paymentMethod: "card",
  });

  useEffect(() => {
    const items = getCart();
    setCart(items);
    if (items.length === 0 && !orderComplete) router.push("/products");

    // Pre-fill from logged-in customer
    const cust = (window as any).__storeCustomer;
    if (cust) {
      setForm(prev => ({
        ...prev,
        name: prev.name || cust.name || "",
        email: prev.email || cust.email || "",
        phone: prev.phone || cust.phone || "",
      }));
    }

    // Default to first shipping method
    if (shippingMethods?.length > 0) {
      setForm(prev => ({ ...prev, shippingMethodId: prev.shippingMethodId || shippingMethods[0].id }));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const subtotal = getCartTotal(cart);
  const selectedMethod = (shippingMethods || []).find((m: any) => m.id === form.shippingMethodId);
  const freeThreshold = (storeInfo as any).freeShippingThresholdCents || 0;
  const isFreeShipping = freeThreshold > 0 && subtotal >= freeThreshold;
  const shippingCost = isFreeShipping ? 0 : (selectedMethod?.priceCents || 0);
  const total = subtotal + shippingCost;

  const canNext = () => {
    if (step === 0) return form.name && form.email;
    if (step === 1) return form.street && form.city && form.zip && form.shippingMethodId;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const slug = STORE_SLUG || (storeInfo as any).slug || "";
      const res = await fetch(`${API_BASE}/api/store/${slug}/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          customerInfo: {
            name: form.name,
            email: form.email,
            phone: form.phone,
          },
          shippingAddress: {
            name: form.name,
            line1: form.street,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          },
          shippingMethod: selectedMethod?.name || "Standard",
          paymentMethod: form.paymentMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        clearCart();
        setOrderComplete(true);
        setOrderNumber(json.data?.orderNumber || "");
        if (json.data?.clientSecret && form.paymentMethod === "card") {
          // Stripe payment — redirect handled by store
          window.location.href = `/checkout/confirm?secret=${json.data.clientSecret}&order=${json.data.orderId}`;
          return;
        }
      } else {
        setError(json.error?.message || "Checkout failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Placed!</h1>
          {orderNumber && <p className="text-gray-500 dark:text-gray-400 mb-6">Order #{orderNumber}</p>}
          <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition-colors">
            Continue Shopping
          </Link>
        </motion.div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/products" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <ArrowLeft size={16} /> Back to Shopping
          </Link>
          {(storeInfo as any).logoUrl && (
            <img src={(storeInfo as any).logoUrl} alt={(storeInfo as any).name || "Store"} className="h-8 object-contain" />
          )}
          <div className="text-sm font-medium text-gray-900 dark:text-white">Checkout</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  i === step ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25" :
                  i < step ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-pointer" :
                  "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                }`}
              >
                {i < step ? <Check size={16} /> : <s.icon size={16} />}
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${i < step ? "bg-green-400" : "bg-gray-200 dark:bg-gray-700"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Form */}
          <div>
            {/* Step 1: Contact Info */}
            {step === 0 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 space-y-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Contact Information</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
                    <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="john@example.com" className={inputClass} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" className={inputClass} />
                </div>
              </motion.div>
            )}

            {/* Step 2: Shipping */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 space-y-5">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shipping Address</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Street Address *</label>
                    <input type="text" name="street" value={form.street} onChange={handleChange} placeholder="123 Main St" className={inputClass} required />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">City *</label>
                      <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="New York" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">State</label>
                      <input type="text" name="state" value={form.state} onChange={handleChange} placeholder="NY" className={inputClass} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ZIP Code *</label>
                      <input type="text" name="zip" value={form.zip} onChange={handleChange} placeholder="10001" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Country</label>
                      <select name="country" value={form.country} onChange={handleChange} className={inputClass}>
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                        <option value="FR">France</option>
                        <option value="DE">Germany</option>
                        <option value="CI">Ivory Coast</option>
                        <option value="NG">Nigeria</option>
                        <option value="GH">Ghana</option>
                        <option value="KE">Kenya</option>
                        <option value="ZA">South Africa</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Shipping Methods */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 space-y-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck size={20} /> Shipping Method
                  </h2>
                  <div className="space-y-3">
                    {(shippingMethods || []).map((method: any) => {
                      const methodCost = isFreeShipping ? 0 : method.priceCents;
                      return (
                        <label key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          form.shippingMethodId === method.id
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}>
                          <input
                            type="radio"
                            name="shippingMethodId"
                            value={method.id}
                            checked={form.shippingMethodId === method.id}
                            onChange={handleChange}
                            className="w-4 h-4 text-primary-600"
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{method.description || method.estimatedDays}</p>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {methodCost === 0 ? "Free" : formatPrice(methodCost)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {isFreeShipping && (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      You qualify for free shipping on orders over {formatPrice(freeThreshold)}!
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Payment */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 space-y-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard size={20} /> Payment Method
                </h2>
                <div className="space-y-3">
                  {[
                    { value: "card", label: "Credit / Debit Card", icon: "💳" },
                    { value: "cod", label: "Cash on Delivery", icon: "💵" },
                    { value: "mobile_money", label: "Mobile Money", icon: "📱" },
                    { value: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
                  ].map((pm) => (
                    <label key={pm.value} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      form.paymentMethod === pm.value
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={pm.value}
                        checked={form.paymentMethod === pm.value}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-lg">{pm.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{pm.label}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              {step > 0 ? (
                <button onClick={() => setStep(s => s - 1)} className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>
              ) : <div />}

              {step < 2 ? (
                <button
                  onClick={() => canNext() && setStep(s => s + 1)}
                  disabled={!canNext()}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary-600/25"
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-600/25"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
                  {loading ? "Processing..." : "Place Order"}
                </button>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:sticky lg:top-8 self-start">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Order Summary</h2>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                      {item.variantName && <p className="text-xs text-gray-500 dark:text-gray-400">{item.variantName}</p>}
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary-600 flex-shrink-0">{formatPrice(item.priceCents * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Shipping</span>
                  <span className={isFreeShipping ? "text-green-600" : ""}>{shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span>Total</span>
                  <span className="text-primary-600">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
