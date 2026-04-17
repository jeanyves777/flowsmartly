/**
 * SSR-specific templates for V3 independent store apps.
 *
 * These replace/supplement the static export templates when generating
 * a fully independent SSR store that can be self-hosted.
 */

// ─── next.config.ts ─────────────────────────────────────────────────────────
// assetPrefix is required so that /_next/static/ requests are prefixed with
// the store's nginx subpath (e.g. /stores/my-store). Without it the browser
// requests /_next/… which nginx routes to the main FlowSmartly app instead
// of the store, causing all CSS/JS to 404 (naked pages).

export function generateSSRNextConfig(assetPrefix: string): string {
  return `import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  basePath: "${assetPrefix}",
  assetPrefix: "${assetPrefix}",
  // Required: prevents Next.js from 308-redirecting /slug/ → /slug,
  // which nginx cannot re-handle (nginx location block requires trailing slash).
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  // Prevent Next.js from walking up to a parent workspace when nested inside a monorepo
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow the store to be embedded in the FlowSmartly dashboard preview iframe
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
`;
}

/** @deprecated Use generateSSRNextConfig(slug) instead */
export const TEMPLATE_SSR_NEXT_CONFIG = generateSSRNextConfig("");

// ─── app/not-found.tsx ───────────────────────────────────────────────────────
// Required to prevent Next.js from falling back to the Pages Router /404 page,
// which imports <Html> from next/document and fails in App Router builds.
export const TEMPLATE_SSR_NOT_FOUND = `import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-xl text-muted-foreground">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        Back to Home
      </Link>
    </main>
  );
}
`;

// ─── .env.local ──────────────────────────────────────────────────────────────

export function getEnvLocal(slug: string, apiGatewayUrl: string = "https://flowsmartly.com"): string {
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  return `# FlowSmartly API Gateway — change this to self-host with your own backend
API_GATEWAY_URL=${apiGatewayUrl}

# Store identifier
STORE_SLUG=${slug}

# Stripe — publishable key for client-side payment confirmation
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${stripeKey}
`;
}

// ─── Stripe Payment Confirm Page (src/app/checkout/confirm/page.tsx) ──────────
// Pre-built by the builder — uses Stripe PaymentElement to confirm payment.
// The agent must NOT overwrite this file.

export const TEMPLATE_STRIPE_CONFIRM_PAGE = `"use client";

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

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: window.location.origin + "/checkout/success?order=" + orderId,
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
        {loading ? "Processing Payment..." : amount ? "Pay " + formatPrice(amount) : "Pay Now"}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><Lock size={12} /> SSL Encrypted</span>
        <span>Powered by Stripe</span>
        <span>Visa \xB7 Mastercard \xB7 Amex</span>
      </div>
    </form>
  );
}

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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment Session Expired</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Please return to the shop and try again.</p>
            <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition-colors">
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
    variables: { colorPrimary: "#6366f1", borderRadius: "12px", fontFamily: "inherit" },
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Your order is reserved \u2014 enter your payment details to confirm</p>
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
`;

// ─── API Gateway Client (src/lib/api-client.ts) ─────────────────────────────

export const TEMPLATE_API_CLIENT = `/**
 * API Gateway Client — routes all backend calls to FlowSmartly.
 *
 * All backend operations (checkout, auth, orders, products) go through this client.
 * To self-host: change API_GATEWAY_URL in .env.local to point to your own backend.
 */

const API_BASE = process.env.API_GATEWAY_URL || "https://flowsmartly.com";
const SLUG = process.env.STORE_SLUG || "";

/**
 * Make a request to the FlowSmartly API gateway.
 * @param path - API path after /api/store/{slug}/, e.g. "/checkout", "/auth/login"
 * @param init - Fetch options (method, body, headers)
 */
export async function gateway(path: string, init?: RequestInit): Promise<Response> {
  const url = \`\${API_BASE}/api/store/\${SLUG}\${path}\`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

/**
 * Make a gateway request and parse the JSON response.
 */
export async function gatewayJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await gateway(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(\`API error \${res.status}: \${text}\`);
  }
  return res.json();
}

/** API base URL for client-side calls (relative to current origin) */
export const API_URL = "/api";

/** Gateway base URL (for server-side use) */
export const GATEWAY_BASE = API_BASE;
export const STORE_SLUG = SLUG;
`;

// ─── API Proxy Route (src/app/api/[...path]/route.ts) ────────────────────────

export const TEMPLATE_API_PROXY = `/**
 * API Proxy — forwards all /api/* requests to the FlowSmartly gateway.
 *
 * This is the single integration point between the independent store app
 * and the FlowSmartly backend. Routes:
 *
 *   /api/checkout        → /api/store/{slug}/checkout
 *   /api/auth/login      → /api/store/{slug}/auth/login
 *   /api/auth/register   → /api/store/{slug}/auth/register
 *   /api/auth/logout     → /api/store/{slug}/auth/logout
 *   /api/account/profile → /api/store/{slug}/account/profile
 *   /api/account/orders  → /api/store/{slug}/account/orders
 *   /api/account/addresses → /api/store/{slug}/account/addresses
 *   /api/products        → /api/store/{slug}/products
 *   /api/products/{slug} → /api/store/{slug}/products/{slug}
 *   /api/recommendations → /api/store/{slug}/recommendations
 *   /api/analytics/*     → /api/analytics/*
 */

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_GATEWAY_URL || "https://flowsmartly.com";
const SLUG = process.env.STORE_SLUG || "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");

  // Map local API paths to gateway paths
  let gatewayPath: string;
  if (path.startsWith("analytics")) {
    // Analytics goes to the global analytics endpoint
    gatewayPath = \`/api/\${path}\`;
  } else {
    // Everything else goes through /api/store/{slug}/
    gatewayPath = \`/api/store/\${SLUG}/\${path}\`;
  }

  const targetUrl = \`\${API_BASE}\${gatewayPath}\`;

  // Forward headers (including cookies for auth)
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Skip hop-by-hop headers
    if (!["host", "connection", "transfer-encoding"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("X-Store-Slug", SLUG);
  headers.set("X-Forwarded-Host", req.headers.get("host") || "");

  try {
    // Forward the request body for non-GET methods
    let body: BodyInit | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // Forward the response
    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(\`[api-proxy] Error forwarding \${req.method} \${path}:\`, err.message);
    return NextResponse.json(
      { error: "Gateway error", message: err.message },
      { status: 502 }
    );
  }
}
`;

// ─── Updated cart.ts (local checkout, no redirect) ───────────────────────────

export const TEMPLATE_SSR_CART = `/**
 * Cart state management using localStorage.
 * This is a client-side only module.
 *
 * Checkout happens WITHIN this app at /checkout — no external redirects.
 */

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  priceCents: number;
  quantity: number;
  imageUrl: string;
}

function getCartKey(): string {
  if (typeof window === "undefined") return "flowshop-cart";
  const match = window.location.pathname.match(/^\\/stores\\/([^/]+)/);
  return match ? \`flowshop-cart-\${match[1]}\` : "flowshop-cart";
}

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getCartKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getCartKey(), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart-updated"));
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity: number = 1): void {
  const cart = getCart();
  const key = item.variantId ? \`\${item.productId}:\${item.variantId}\` : item.productId;
  const existing = cart.find(
    (i) => (i.variantId ? \`\${i.productId}:\${i.variantId}\` : i.productId) === key
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...item, quantity });
  }
  saveCart(cart);
}

export function removeFromCart(productId: string, variantId?: string): void {
  const cart = getCart();
  const key = variantId ? \`\${productId}:\${variantId}\` : productId;
  saveCart(cart.filter((i) => (i.variantId ? \`\${i.productId}:\${i.variantId}\` : i.productId) !== key));
}

export function updateQuantity(productId: string, variantId: string | undefined, quantity: number): void {
  const cart = getCart();
  const key = variantId ? \`\${productId}:\${variantId}\` : productId;
  const item = cart.find((i) => (i.variantId ? \`\${i.productId}:\${i.variantId}\` : i.productId) === key);

  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
    } else {
      item.quantity = quantity;
      saveCart(cart);
    }
  }
}

export function clearCart(): void {
  saveCart([]);
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function getCartCount(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

/** Navigate to the local checkout page — respects basePath for SSR stores */
export function goToCheckout(): void {
  if (getCart().length === 0) return;
  // SSR stores are served under /stores/{slug}/ — extract basePath from current URL
  const match = window.location.pathname.match(/^\\/stores\\/[^/]+/);
  const basePath = match ? match[0] : "";
  window.location.href = basePath + "/checkout/";
}
`;

// ─── Updated analytics (uses local proxy) ────────────────────────────────────

export function getSSRTrackingScript(storeId: string): string {
  return `"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const consent = localStorage.getItem("cookie-consent");
    if (consent === "declined") return;

    const data = {
      type: "pageview",
      storeId: "${storeId}",
      path: pathname || window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      url: window.location.href,
    };

    // Uses local /api/analytics proxy → FlowSmartly gateway
    fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  }, [pathname]);

  return null;
}

export function trackEvent(eventType: string, data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const consent = localStorage.getItem("cookie-consent");
  if (consent === "declined") return;

  fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: eventType,
      storeId: "${storeId}",
      ...data,
      url: window.location.href,
    }),
  }).catch(() => {});
}
`;
}
