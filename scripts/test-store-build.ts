#!/usr/bin/env tsx
/**
 * test-store-build.ts
 *
 * Dry-run end-to-end test for the store builder pipeline.
 * No AI API calls, no credits consumed, no DB required.
 *
 * What it does:
 *   1. Creates a test store directory using initStoreDirV3 (writes all template files)
 *   2. Writes fixture source files simulating what the AI agent would generate
 *      (includes an intentional import bug so we can verify the validator fixes it)
 *   3. Runs all pre-build validators
 *   4. Runs `next build` and reports pass/fail
 *
 * Usage:
 *   npx tsx scripts/test-store-build.ts [options]
 *
 * Options:
 *   --keep           Keep test store directory after the run (default: clean up on success)
 *   --validate-only  Run validators only — skip npm install + next build
 *   --clean          Delete existing test store dir first (fresh start)
 *   --verbose        Show full build output on success
 */

import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// ─── Resolve paths relative to repo root ─────────────────────────────────────

const REPO_ROOT = join(__dirname, "..");

// Load store builder modules via relative paths
const { initStoreDirV3, buildStoreFromDir, getStoreDir } = require(
  join(REPO_ROOT, "src/lib/store-builder/store-site-builder")
) as typeof import("../src/lib/store-builder/store-site-builder");

const {
  cleanupV3Patterns,
  fixTailwindV4Classes,
  fixGlobalsCss,
  fixUseSearchParams,
  validateAndFixImports,
  fixCartImports,
  fixDataSyntax,
  fixHamburgerMenu,
  injectAnalytics,
} = require(
  join(REPO_ROOT, "src/lib/build-utils/validators")
) as typeof import("../src/lib/build-utils/validators");

// ─── Config ───────────────────────────────────────────────────────────────────

const TEST_STORE_ID = "dry-run-test-store-001";
const TEST_SLUG = "dry-run-test";

const args = process.argv.slice(2);
const KEEP = args.includes("--keep");
const VALIDATE_ONLY = args.includes("--validate-only");
const CLEAN = args.includes("--clean");
const VERBOSE = args.includes("--verbose");

// ─── CLI helpers ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function log(msg: string) { process.stdout.write(msg + "\n"); }
function ok(msg: string)  { log(`  ${c.green}✔${c.reset}  ${msg}`); }
function fail(msg: string){ log(`  ${c.red}✘${c.reset}  ${msg}`); }
function info(msg: string){ log(`  ${c.cyan}›${c.reset}  ${msg}`); }
function warn(msg: string){ log(`  ${c.yellow}!${c.reset}  ${msg}`); }
function section(title: string) {
  log(`\n${c.bold}${c.blue}── ${title} ${c.reset}${"─".repeat(Math.max(0, 55 - title.length))}`);
}
function header(title: string) {
  log(`\n${c.bold}${c.magenta}${"═".repeat(60)}${c.reset}`);
  log(`${c.bold}${c.magenta}  ${title}${c.reset}`);
  log(`${c.bold}${c.magenta}${"═".repeat(60)}${c.reset}`);
}

// ─── Fixture source files (what the AI agent would generate) ─────────────────

function writeFixtures(storeDir: string): void {
  const src = join(storeDir, "src");

  // ── src/lib/data.ts ────────────────────────────────────────────────────────
  writeFileSync(join(src, "lib", "data.ts"), `
export const storeInfo = {
  name: "Demo Shop",
  tagline: "Quality products for everyone",
  description: "Welcome to Demo Shop — your one-stop store for premium goods.",
  currency: "USD",
  email: "hello@demoshop.example",
  phone: "+1 555 0100",
  address: "123 Main Street",
  city: "Springfield",
  state: "IL",
  country: "US",
};

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export const categories = [
  { id: "widgets", name: "Widgets", slug: "widgets", description: "Top-quality widgets" },
  { id: "gadgets", name: "Gadgets", slug: "gadgets", description: "Smart gadgets for modern life" },
];

export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "About", href: "/about" },
];

export const footerLinks = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
];
`.trimStart());

  // ── src/lib/products.ts ───────────────────────────────────────────────────
  writeFileSync(join(src, "lib", "products.ts"), `
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  comparePriceCents?: number;
  category: string;
  imageUrl: string;
  images?: string[];
  tags?: string[];
  status: "active" | "draft";
}

export const products: Product[] = [
  {
    id: "prod-001",
    name: "Premium Widget",
    slug: "premium-widget",
    description: "A top-quality widget built to last. Perfect for everyday use.",
    priceCents: 2999,
    comparePriceCents: 4999,
    category: "widgets",
    imageUrl: "/images/products/widget-1.jpg",
    status: "active",
    tags: ["widget", "premium", "bestseller"],
  },
  {
    id: "prod-002",
    name: "Deluxe Gadget",
    slug: "deluxe-gadget",
    description: "A smart gadget that simplifies your daily workflow.",
    priceCents: 4999,
    comparePriceCents: 6999,
    category: "gadgets",
    imageUrl: "/images/products/gadget-1.jpg",
    status: "active",
    tags: ["gadget", "smart", "tech"],
  },
  {
    id: "prod-003",
    name: "Classic Accessory",
    slug: "classic-accessory",
    description: "A timeless accessory that complements any lifestyle.",
    priceCents: 1499,
    category: "widgets",
    imageUrl: "/images/products/accessory-1.jpg",
    status: "active",
    tags: ["accessory", "classic"],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category && p.status === "active");
}
`.trimStart());

  // ── src/app/globals.css ───────────────────────────────────────────────────
  writeFileSync(join(src, "app", "globals.css"), `
@import "tailwindcss";

@theme {
  --color-primary: #6C63FF;
  --color-secondary: #4ECDC4;
  --color-accent: #FF6B6B;
  --font-sans: system-ui, sans-serif;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans);
}
`.trimStart());

  // ── src/app/layout.tsx ────────────────────────────────────────────────────
  writeFileSync(join(src, "app", "layout.tsx"), `
import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import Analytics from "@/components/Analytics";
import CookieConsent from "@/components/CookieConsent";
import { storeInfo } from "@/lib/data";

export const metadata: Metadata = {
  title: storeInfo.name,
  description: storeInfo.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
`.trimStart());

  // ── src/app/page.tsx ──────────────────────────────────────────────────────
  writeFileSync(join(src, "app", "page.tsx"), `
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { products } from "@/lib/products";

export default function HomePage() {
  const featured = products.filter((p) => p.status === "active").slice(0, 3);
  return (
    <main>
      <Header />
      <Hero />
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Featured Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
`.trimStart());

  // ── src/app/products/page.tsx ─────────────────────────────────────────────
  mkdirSync(join(src, "app", "products"), { recursive: true });
  writeFileSync(join(src, "app", "products", "page.tsx"), `
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { products } from "@/lib/products";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Products — Demo Shop" };

export default function ProductsPage() {
  const active = products.filter((p) => p.status === "active");
  return (
    <main>
      <Header />
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-10">All Products</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {active.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
`.trimStart());

  // ── src/app/products/[slug]/page.tsx ──────────────────────────────────────
  writeFileSync(join(src, "app", "products", "[slug]", "page.tsx"), `
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getProductBySlug, products } from "@/lib/products";
import { formatPrice } from "@/lib/data";
import type { Metadata } from "next";

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  return { title: product ? \`\${product.name} — Demo Shop\` : "Not Found" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <main>
      <Header />
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="bg-gray-100 rounded-xl aspect-square flex items-center justify-center text-gray-400">
            No image
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            <p className="text-2xl font-semibold text-primary mb-6">{formatPrice(product.priceCents)}</p>
            <p className="text-gray-600 mb-8">{product.description}</p>
            <button className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition">
              Add to Cart
            </button>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
`.trimStart());

  // ── src/app/about/page.tsx ────────────────────────────────────────────────
  writeFileSync(join(src, "app", "about", "page.tsx"), `
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { storeInfo } from "@/lib/data";

export default function AboutPage() {
  return (
    <main>
      <Header />
      <section className="py-20 px-6 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-6">About {storeInfo.name}</h1>
        <p className="text-lg text-gray-600">{storeInfo.description}</p>
      </section>
      <Footer />
    </main>
  );
}
`.trimStart());

  // ── src/app/checkout/CheckoutClient.tsx ───────────────────────────────────
  // ⚠️  INTENTIONAL BUG: getCart and getCartCount imported from @/lib/data
  //     The fixCartImports validator must rewrite this to @/lib/cart before build.
  writeFileSync(join(src, "app", "checkout", "CheckoutClient.tsx"), `
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// ⚠️ BUG: getCart & getCartCount should come from @/lib/cart — validator will fix this
import { getCart, getCartCount, formatPrice } from "@/lib/data";
import type { CartItem } from "@/lib/cart";

export default function CheckoutClient() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setCart(getCart());
    const onUpdate = () => setCart(getCart());
    window.addEventListener("cart-updated", onUpdate);
    return () => window.removeEventListener("cart-updated", onUpdate);
  }, []);

  const count = getCartCount(cart);
  const total = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  if (count === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl mb-6">Your cart is empty.</p>
        <Link href="/products" className="bg-primary text-white px-6 py-3 rounded-lg font-semibold">
          Browse Products
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, customerEmail: email, items: cart }),
      });
      const data = await res.json();
      if (data.success) router.push(\`/order-confirmation?order=\${data.data.orderId}\`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <div className="mb-8">
        {cart.map((item) => (
          <div key={item.productId} className="flex justify-between py-3 border-b">
            <span>{item.name} × {item.quantity}</span>
            <span>{formatPrice(item.priceCents * item.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between py-4 font-bold text-lg">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border rounded-lg px-4 py-3"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          className="w-full border rounded-lg px-4 py-3"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Processing..." : "Place Order"}
        </button>
      </form>
    </div>
  );
}
`.trimStart());

  // ── src/app/checkout/page.tsx ─────────────────────────────────────────────
  writeFileSync(join(src, "app", "checkout", "page.tsx"), `
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CheckoutClient from "./CheckoutClient";

export default function CheckoutPage() {
  return (
    <main>
      <Header />
      <CheckoutClient />
      <Footer />
    </main>
  );
}
`.trimStart());

  // ── src/app/order-confirmation/ ───────────────────────────────────────────
  // Simulate Case B: server page.tsx imports a client component that uses useSearchParams
  // WITHOUT wrapping in Suspense — this is the real AI-generated bug pattern
  mkdirSync(join(src, "app", "order-confirmation"), { recursive: true });

  // The CLIENT component (has useSearchParams, no Suspense wrapper in page)
  writeFileSync(join(src, "app", "order-confirmation", "OrderConfirmationClient.tsx"), `
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function OrderConfirmationClient() {
  const params = useSearchParams();
  const orderId = params.get("order");
  return (
    <div className="text-center py-20 px-6">
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
      {orderId && <p className="text-gray-500 mb-8">Order ID: {orderId}</p>}
      <Link href="/" className="bg-primary text-white px-8 py-3 rounded-lg font-semibold">
        Continue Shopping
      </Link>
    </div>
  );
}
`.trimStart());

  // The SERVER page — renders the client component WITHOUT Suspense (AI bug pattern)
  writeFileSync(join(src, "app", "order-confirmation", "page.tsx"), `
import OrderConfirmationClient from "./OrderConfirmationClient";

export default function Page() {
  return <OrderConfirmationClient />;
}
`.trimStart());

  // ── src/components/Header.tsx ─────────────────────────────────────────────
  writeFileSync(join(src, "components", "Header.tsx"), `
"use client";

import { useState } from "react";
import Link from "next/link";
import { navLinks, storeInfo } from "@/lib/data";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          {storeInfo.name}
        </Link>
        <nav className="hidden md:flex gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-gray-600 hover:text-primary transition">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/checkout" className="relative">
            🛒
          </Link>
          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t px-6 py-4 flex flex-col gap-3 bg-white">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-gray-700 hover:text-primary" onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
`.trimStart());

  // ── src/components/Hero.tsx ───────────────────────────────────────────────
  writeFileSync(join(src, "components", "Hero.tsx"), `
import Link from "next/link";
import { storeInfo } from "@/lib/data";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-primary/10 to-secondary/10 py-24 px-6 text-center">
      <h1 className="text-5xl font-bold mb-6">{storeInfo.tagline}</h1>
      <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">{storeInfo.description}</p>
      <Link
        href="/products"
        className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition"
      >
        Shop Now
      </Link>
    </section>
  );
}
`.trimStart());

  // ── src/components/ProductCard.tsx ────────────────────────────────────────
  writeFileSync(join(src, "components", "ProductCard.tsx"), `
"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/data";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

interface Props { product: Product }

export default function ProductCard({ product }: Props) {
  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
    });
  };

  return (
    <div className="border rounded-xl overflow-hidden hover:shadow-lg transition group">
      <Link href={\`/products/\${product.slug}\`}>
        <div className="bg-gray-100 aspect-square flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition">
          📦
        </div>
      </Link>
      <div className="p-4">
        <Link href={\`/products/\${product.slug}\`}>
          <h3 className="font-semibold text-lg mb-1 hover:text-primary transition">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-primary font-bold">{formatPrice(product.priceCents)}</span>
          {product.comparePriceCents && (
            <span className="text-gray-400 line-through text-sm">{formatPrice(product.comparePriceCents)}</span>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          className="w-full bg-primary text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
`.trimStart());

  // ── src/components/Footer.tsx ─────────────────────────────────────────────
  writeFileSync(join(src, "components", "Footer.tsx"), `
import Link from "next/link";
import { storeInfo, footerLinks } from "@/lib/data";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 px-6 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <p className="text-white font-bold text-xl mb-2">{storeInfo.name}</p>
            <p className="text-sm">{storeInfo.tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-4">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm hover:text-white transition">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-xs text-gray-500 text-center">
          © {new Date().getFullYear()} {storeInfo.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
`.trimStart());
}

// ─── Validator runner (captures what each validator changes) ──────────────────

interface ValidatorResult {
  name: string;
  triggered: boolean;
  detail?: string;
}

function runValidators(storeDir: string): ValidatorResult[] {
  const results: ValidatorResult[] = [];

  const capture = (name: string, fn: () => void): ValidatorResult => {
    // Peek at relevant files before + after to detect changes
    const before = snapshotSrc(storeDir);
    fn();
    const after = snapshotSrc(storeDir);
    const changed = Object.keys(before).filter((f) => before[f] !== after[f]);
    return { name, triggered: changed.length > 0, detail: changed.length > 0 ? `${changed.length} file(s) modified` : undefined };
  };

  results.push(capture("cleanupV3Patterns", () => cleanupV3Patterns(storeDir)));
  results.push(capture("fixTailwindV4Classes", () => fixTailwindV4Classes(storeDir)));
  results.push(capture("fixGlobalsCss", () => fixGlobalsCss(storeDir)));
  results.push(capture("fixUseSearchParams", () => fixUseSearchParams(storeDir)));

  // validateAndFixImports: captures stub count
  const stubs = validateAndFixImports(storeDir);
  results.push({
    name: "validateAndFixImports",
    triggered: stubs.length > 0,
    detail: stubs.length > 0 ? `created ${stubs.length} stub(s): ${stubs.join(", ")}` : undefined,
  });

  results.push(capture("fixCartImports", () => fixCartImports(storeDir)));
  results.push(capture("fixDataSyntax (data.ts)", () => fixDataSyntax(storeDir, "src/lib/data.ts")));
  results.push(capture("fixDataSyntax (products.ts)", () => fixDataSyntax(storeDir, "src/lib/products.ts")));
  results.push(capture("fixHamburgerMenu", () => fixHamburgerMenu(storeDir)));
  results.push(capture("injectAnalytics", () => injectAnalytics(storeDir)));

  return results;
}

function snapshotSrc(storeDir: string): Record<string, string> {
  const { readdirSync, statSync } = require("fs") as typeof import("fs");
  const srcDir = join(storeDir, "src");
  const snap: Record<string, string> = {};
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.(tsx?|jsx?|css)$/.test(entry)) {
        try { snap[full] = readFileSync(full, "utf-8"); } catch {}
      }
    }
  };
  walk(srcDir);
  return snap;
}

// ─── Verify the cart import was actually fixed ────────────────────────────────

function verifyCartImportFixed(storeDir: string): boolean {
  const checkoutClient = join(storeDir, "src", "app", "checkout", "CheckoutClient.tsx");
  if (!existsSync(checkoutClient)) return false;
  const content = readFileSync(checkoutClient, "utf-8");
  // Should NOT have getCart/getCartCount from @/lib/data after fix
  const stillBroken = /import\s*\{[^}]*(?:getCart|getCartCount)[^}]*\}\s*from\s*["']@\/lib\/data["']/.test(content);
  return !stillBroken;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  header("FlowSmartly Store Builder — Dry Run Test");

  // Get store dir path without running initStoreDirV3 yet
  const storeDir: string = (getStoreDir as (id: string) => string)(TEST_STORE_ID);

  section("Configuration");
  info(`Store ID : ${TEST_STORE_ID}`);
  info(`Store dir: ${storeDir}`);
  info(`Mode     : ${VALIDATE_ONLY ? "validate only" : "full build"}`);

  // ── Clean ─────────────────────────────────────────────────────────────────
  if (CLEAN && existsSync(storeDir)) {
    section("Cleaning existing test store");
    rmSync(storeDir, { recursive: true, force: true });
    ok("Removed existing test store directory");
  }

  // ── Init store dir ────────────────────────────────────────────────────────
  section("Initializing store directory");
  // initStoreDirV3 is idempotent — safe to call even if dir already exists
  (initStoreDirV3 as (id: string, slug: string) => string)(TEST_STORE_ID, TEST_SLUG);
  ok("Store directory ready with template files");
  ok("Wrote: next.config.ts, cart.ts, api-client.ts, api proxy, ThemeProvider, Analytics, CookieConsent");

  // ── Write fixture files ───────────────────────────────────────────────────
  section("Writing fixture source files (simulating AI output)");
  writeFixtures(storeDir);
  ok("data.ts, products.ts, globals.css, layout.tsx, page.tsx");
  ok("products/page.tsx, products/[slug]/page.tsx, about/page.tsx");
  ok("checkout/CheckoutClient.tsx  ⚠ (intentional bug: getCart from @/lib/data)");
  ok("checkout/page.tsx, order-confirmation/page.tsx + OrderConfirmationClient.tsx  ⚠ (no Suspense wrapper)");
  ok("components: Header, Hero, ProductCard, Footer");

  // ── Run validators ────────────────────────────────────────────────────────
  section("Running pre-build validators");
  const validatorResults = runValidators(storeDir);

  let anyFixed = false;
  for (const r of validatorResults) {
    if (r.triggered) {
      ok(`${r.name} — fixed (${r.detail})`);
      anyFixed = true;
    } else {
      log(`  ${c.dim}  ${r.name} — no changes needed${c.reset}`);
    }
  }

  if (!anyFixed) {
    warn("No validators triggered any fixes");
  }

  // ── Verify the cart import bug was fixed ──────────────────────────────────
  section("Verifying validator correctness");
  const cartFixed = verifyCartImportFixed(storeDir);
  if (cartFixed) {
    ok("fixCartImports: getCart/getCartCount successfully moved from @/lib/data → @/lib/cart");
  } else {
    fail("fixCartImports: CheckoutClient.tsx still has getCart from @/lib/data — validator did NOT fix it!");
    process.exitCode = 1;
  }

  // Verify Suspense was added to order-confirmation/page.tsx (Case B fix)
  const orderPagePath = join(storeDir, "src", "app", "order-confirmation", "page.tsx");
  const orderPageContent = existsSync(orderPagePath) ? readFileSync(orderPagePath, "utf-8") : "";
  if (orderPageContent.includes("Suspense")) {
    ok("fixUseSearchParams (case B): Suspense added to order-confirmation/page.tsx");
  } else {
    fail("fixUseSearchParams (case B): order-confirmation/page.tsx is missing Suspense — server renders client with useSearchParams without boundary!");
    process.exitCode = 1;
  }

  if (VALIDATE_ONLY) {
    section("Summary (validate-only mode)");
    log(`\n${c.bold}${c.green}  ✔ Validator test complete. Skipping build.${c.reset}\n`);
    if (!KEEP) cleanup(storeDir);
    return;
  }

  // ── npm install ───────────────────────────────────────────────────────────
  section("Installing dependencies");
  const nodeModulesExist = existsSync(join(storeDir, "node_modules", "next"));
  if (nodeModulesExist) {
    ok("node_modules already present — skipping npm install");
  } else {
    info("Running npm install --include=dev (this may take a few minutes)...");
    const t0 = Date.now();
    try {
      execSync("npm install --include=dev", {
        cwd: storeDir,
        stdio: "inherit",
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048", NODE_ENV: "development" },
        timeout: 180000,
      });
      ok(`Dependencies installed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err: any) {
      fail(`npm install failed: ${err.message}`);
      process.exitCode = 1;
      if (!KEEP) cleanup(storeDir);
      return;
    }
  }

  // ── next build ────────────────────────────────────────────────────────────
  section("Running next build");
  info("Building store — this takes ~1–3 minutes...");

  const buildStart = Date.now();
  let buildOutput = "";
  let buildSuccess = false;

  try {
    // Clear .next cache for a clean test
    const nextCache = join(storeDir, ".next");
    if (existsSync(nextCache)) rmSync(nextCache, { recursive: true, force: true });

    buildOutput = execSync("npx next build", {
      cwd: storeDir,
      encoding: "utf-8",
      env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=2048",
        // Ensure Next.js runs in a clean production context.
        // VS Code sets ELECTRON_RUN_AS_NODE which confuses Next.js on Windows.
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "",
      },
      timeout: 300000,
    }).toString();
    buildSuccess = true;
  } catch (err: any) {
    buildOutput = (err.stderr || "") + "\n" + (err.stdout || "") + "\n" + (err.message || "");
  }

  const buildTime = ((Date.now() - buildStart) / 1000).toFixed(1);

  if (buildSuccess) {
    ok(`Build succeeded in ${buildTime}s`);
    if (VERBOSE) {
      log(`\n${c.dim}${buildOutput}${c.reset}`);
    }
  } else {
    fail(`Build FAILED after ${buildTime}s`);
    // Show last 60 lines of error output
    const lines = buildOutput.split("\n").filter(Boolean);
    const tail = lines.slice(-60).join("\n");
    log(`\n${c.dim}${tail}${c.reset}`);
    process.exitCode = 1;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  section("Summary");

  if (buildSuccess && cartFixed) {
    log(`\n${c.bold}${c.green}  ✔ ALL CHECKS PASSED${c.reset}\n`);
    log(`  The store builder pipeline is working correctly.`);
    log(`  Validators fix known AI mistakes. next build succeeds.\n`);
  } else {
    log(`\n${c.bold}${c.red}  ✘ SOME CHECKS FAILED${c.reset}\n`);
    if (!cartFixed) fail("fixCartImports validator did not fix the checkout import bug");
    if (!buildSuccess) fail("next build failed — see output above");
    log("");
  }

  info(`Store dir: ${storeDir}`);
  if (!KEEP && buildSuccess) {
    cleanup(storeDir);
  } else {
    info(`Keeping test dir (${KEEP ? "--keep flag" : "build failed, preserved for inspection"})`);
  }
}

function cleanup(storeDir: string) {
  section("Cleanup");
  try {
    rmSync(storeDir, { recursive: true, force: true });
    ok("Test store directory removed");
  } catch {
    warn("Could not remove test store directory");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
