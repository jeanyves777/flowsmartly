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
  return `# FlowSmartly API Gateway — change this to self-host with your own backend
API_GATEWAY_URL=${apiGatewayUrl}

# Store identifier
STORE_SLUG=${slug}
`;
}

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

const CART_KEY = "flowshop-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
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

/** Navigate to the local checkout page — no external redirect */
export function goToCheckout(): void {
  if (getCart().length === 0) return;
  window.location.href = "/checkout";
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
