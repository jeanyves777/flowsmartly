# Store UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 38 UI/UX issues to deliver mobile-first, branded, polished e-commerce storefronts.

**Architecture:** Two sets of changes — (1) reference-store templates that get cloned for each new store, and (2) main-app store pages used for account/cart flows. Both share the same design language via CSS custom properties.

**Tech Stack:** Next.js 15, Tailwind CSS v4, Lucide React icons, CSS custom properties for theming.

---

## Task 1: ProductCard — Mobile Add-to-Cart Button

**Files:**
- Modify: `reference-store/src/components/ProductCard.tsx:143-165`

- [ ] **Step 1: Make wishlist button larger for mobile touch targets**

In `reference-store/src/components/ProductCard.tsx`, find the wishlist button (around line 143-154) and change `p-2` to `p-2.5`:

```tsx
// OLD
className={`absolute top-3 right-3 z-10 p-2 rounded-full shadow-md transition-all ${
// NEW
className={`absolute top-3 right-3 z-10 p-2.5 rounded-full shadow-md transition-all ${
```

- [ ] **Step 2: Make add-to-cart visible on mobile, hover-only on desktop**

Find the add-to-cart overlay div (around line 157) and change from hover-only to always-visible on mobile:

```tsx
// OLD
<div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
// NEW
<div className="absolute inset-0 flex items-end justify-center pb-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
```

- [ ] **Step 3: Make product name 2-line on mobile**

Find the product name h3 (around line 179) and change `line-clamp-1` to responsive:

```tsx
// OLD
line-clamp-1"
// NEW
line-clamp-2 sm:line-clamp-1"
```

- [ ] **Step 4: Commit**

```bash
git add reference-store/src/components/ProductCard.tsx
git commit -m "feat(store): mobile add-to-cart button, larger touch targets on ProductCard"
```

---

## Task 2: ProductGrid — Mobile Spacing

**Files:**
- Modify: `reference-store/src/components/ProductGrid.tsx`

- [ ] **Step 1: Fix grid gap for mobile**

Find the product grid container (has `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`) and change the gap:

```tsx
// OLD
grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6
// NEW
grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6
```

- [ ] **Step 2: Commit**

```bash
git add reference-store/src/components/ProductGrid.tsx
git commit -m "fix(store): tighter grid gap on mobile ProductGrid"
```

---

## Task 3: MobileBottomNav — Fix Labels, Search, Account

**Files:**
- Modify: `reference-store/src/components/MobileBottomNav.tsx`

- [ ] **Step 1: Fix label size from text-[10px] to text-[11px]**

In `reference-store/src/components/MobileBottomNav.tsx`, line 55:

```tsx
// OLD
<span className={`text-[10px] leading-tight ${item.active ? "text-primary-600 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
// NEW
<span className={`text-[11px] leading-tight ${item.active ? "text-primary-600 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
```

- [ ] **Step 2: Change Search to dispatch event instead of navigating**

Change the items array (line 33-38). Replace the Search item with an onClick handler, and change Account to dispatch toggle-account:

```tsx
const items = [
  { label: "Shop", icon: Home, href: storeUrl("/products"), active: isActive("/products") },
  { label: "Search", icon: Search, onClick: () => window.dispatchEvent(new CustomEvent("open-search")), active: false },
  { label: "Cart", icon: ShoppingBag, badge: cartCount, onClick: onCartOpen, active: false },
  { label: "Account", icon: User, onClick: () => window.dispatchEvent(new CustomEvent("toggle-account")), active: false },
];
```

- [ ] **Step 3: Use store primary color for cart badge**

Line 50, change hardcoded `bg-red-500` to primary:

```tsx
// OLD
<span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
// NEW
<span className="absolute -top-1.5 -right-2.5 bg-primary-600 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
```

- [ ] **Step 4: Commit**

```bash
git add reference-store/src/components/MobileBottomNav.tsx
git commit -m "fix(store): MobileBottomNav search/account events, larger labels, branded badge"
```

---

## Task 4: Main App Cart Drawer — Dark Mode + Touch Targets + Z-Index

**Files:**
- Modify: `src/components/store/cart-drawer.tsx`

- [ ] **Step 1: Fix z-index to layer above mobile nav**

Line 58 (the fixed container div):

```tsx
// OLD
<div className="fixed inset-0 z-50">
// NEW
<div className="fixed inset-0 z-[60]">
```

- [ ] **Step 2: Add dark mode to drawer background**

Line 68 (drawer panel):

```tsx
// OLD
className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col"
// NEW
className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl flex flex-col"
```

- [ ] **Step 3: Add dark mode to header border**

Line 71:

```tsx
// OLD
className="flex items-center justify-between p-4 border-b border-gray-200"
// NEW
className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
```

- [ ] **Step 4: Add dark mode to item borders and empty state**

Find `border-gray-100` in item cards and add dark variant:

```tsx
// OLD
className="flex gap-3 p-3 rounded-lg border border-gray-100"
// NEW
className="flex gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800"
```

- [ ] **Step 5: Enlarge quantity buttons from w-7 h-7 to w-9 h-9**

Find both quantity buttons (Minus and Plus):

```tsx
// OLD (both buttons)
className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
// NEW
className="w-9 h-9 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
```

- [ ] **Step 6: Add dark mode to footer section**

Find the footer border div:

```tsx
// OLD
className="border-t border-gray-200 p-4 space-y-3"
// NEW
className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3"
```

- [ ] **Step 7: Commit**

```bash
git add src/components/store/cart-drawer.tsx
git commit -m "fix(store): cart drawer dark mode, z-index above nav, larger touch targets"
```

---

## Task 5: Main App Mobile Nav — Fix Paths

**Files:**
- Modify: `src/components/store/store-client-shell.tsx`
- Modify: `src/components/store/mobile-nav.tsx`

- [ ] **Step 1: Fix store-client-shell.tsx paths**

In `src/components/store/store-client-shell.tsx`, change all `/store/${storeSlug}` links to `/stores/${storeSlug}`:

```tsx
// OLD
const storeUrl = `/stores/${storeSlug}`;
```

Verify this is already correct. If any navigation items use `/store/` (single), change to `/stores/`.

- [ ] **Step 2: Fix mobile-nav.tsx paths**

In `src/components/store/mobile-nav.tsx`, verify all href values use `/stores/${storeSlug}` prefix (not `/store/${storeSlug}`).

- [ ] **Step 3: Commit**

```bash
git add src/components/store/store-client-shell.tsx src/components/store/mobile-nav.tsx
git commit -m "fix(store): correct mobile nav paths to /stores/ prefix"
```

---

## Task 6: PolicyPage Component — Branded Redesign

**Files:**
- Modify: `reference-store/src/components/PolicyPage.tsx`

- [ ] **Step 1: Rewrite PolicyPage with branded header, breadcrumbs, back button**

Replace the entire `reference-store/src/components/PolicyPage.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { storeInfo, storeUrl } from "@/lib/data";

interface PolicyPageProps {
  title: string;
  icon?: React.ReactNode;
  content: string;
  lastUpdated?: string;
}

export default function PolicyPage({ title, icon, content, lastUpdated }: PolicyPageProps) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 mb-6">
            <Link href={storeUrl("/")} className="hover:text-primary-600 transition-colors">Home</Link>
            <ChevronRight size={14} />
            <span className="text-gray-700 dark:text-gray-200 font-medium">{title}</span>
          </nav>

          {/* Branded header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              {icon && (
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                  {icon}
                </div>
              )}
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h1>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Last updated: {lastUpdated || "January 2026"}
                </p>
              </div>
            </div>
            {/* Accent bar */}
            <div className="h-1 w-20 rounded-full bg-primary-500 mt-4" />
          </div>

          {/* Policy content */}
          <article>
            <div
              className="prose prose-lg dark:prose-invert max-w-none
                prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-headings:font-semibold prose-headings:mt-10 prose-headings:mb-4
                prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed
                prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
                prose-li:text-gray-600 dark:prose-li:text-gray-300
                prose-strong:text-gray-900 dark:prose-strong:text-white"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </article>

          {/* Back to shop */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <Link
              href={storeUrl("/")}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Shop
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} storeSlug="example-store" />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add reference-store/src/components/PolicyPage.tsx
git commit -m "feat(store): branded PolicyPage with icon header, breadcrumbs, accent bar"
```

---

## Task 7: Individual Policy Pages — Add Icons

**Files:**
- Modify: `reference-store/src/app/privacy-policy/page.tsx`
- Modify: `reference-store/src/app/terms/page.tsx`
- Modify: `reference-store/src/app/shipping-policy/page.tsx`
- Modify: `reference-store/src/app/return-policy/page.tsx`

- [ ] **Step 1: Update each policy page to pass icon prop**

Each page imports PolicyPage and passes the appropriate icon. Example for privacy-policy:

```tsx
import { Shield } from "lucide-react";
import PolicyPage from "@/components/PolicyPage";
import { policies } from "@/lib/data";

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      icon={<Shield size={24} />}
      content={policies.privacyPolicy}
      lastUpdated="April 2026"
    />
  );
}
```

For terms: `import { FileText } from "lucide-react"` with `icon={<FileText size={24} />}`
For shipping-policy: `import { Truck } from "lucide-react"` with `icon={<Truck size={24} />}`
For return-policy: `import { RotateCcw } from "lucide-react"` with `icon={<RotateCcw size={24} />}`

- [ ] **Step 2: Commit**

```bash
git add reference-store/src/app/privacy-policy/page.tsx reference-store/src/app/terms/page.tsx reference-store/src/app/shipping-policy/page.tsx reference-store/src/app/return-policy/page.tsx
git commit -m "feat(store): branded icons on all 4 policy pages"
```

---

## Task 8: Reference Store Footer — Add Newsletter Section

**Files:**
- Modify: `reference-store/src/components/Footer.tsx`

- [ ] **Step 1: Add newsletter section and logo fallback**

In `reference-store/src/components/Footer.tsx`, add a newsletter section after the Contact column and before the bottom bar. Also add logo fallback.

Replace lines 22-28 (the brand logo section) with:

```tsx
{/* Brand */}
<div className="md:col-span-1">
  <a href={storeUrl("/")} className="inline-block mb-4">
    {storeInfo.logoUrl ? (
      <img
        src={storeInfo.logoUrl}
        alt={`${storeInfo.name} logo`}
        className="h-20 max-w-[200px] object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    ) : (
      <span className="text-xl font-bold text-gray-900 dark:text-white">
        {storeInfo.name}
      </span>
    )}
  </a>
```

Add after the closing `</div>` of the grid (before bottom bar), insert a newsletter section:

```tsx
{/* Newsletter */}
<div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800">
  <div className="max-w-md mx-auto text-center sm:text-left sm:mx-0">
    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Stay in the loop</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Get updates on new products and exclusive offers.</p>
    <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
      <input
        type="email"
        placeholder="Enter your email"
        className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button
        type="submit"
        className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
      >
        Subscribe
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add reference-store/src/components/Footer.tsx
git commit -m "feat(store): footer newsletter section + logo fallback"
```

---

## Task 9: Main App Store Layout — Expanded Footer

**Files:**
- Modify: `src/app/store/[slug]/layout.tsx:134-152`

- [ ] **Step 1: Replace bare footer with full branded footer**

Replace the minimal footer section (lines 134-152) with:

```tsx
{/* Footer — branded with policies, contact, newsletter */}
<footer
  className="border-t mt-auto"
  style={{
    backgroundColor: "var(--store-background)",
    borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)",
  }}
>
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
      {/* Shop */}
      <div>
        <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Shop</h3>
        <ul className="space-y-2 text-sm" style={{ color: "color-mix(in srgb, var(--store-text) 60%, transparent)" }}>
          <li><a href={storeUrl} className="hover:opacity-100 transition-opacity">All Products</a></li>
          <li><a href={`${storeUrl}/about`} className="hover:opacity-100 transition-opacity">About Us</a></li>
          <li><a href={`${storeUrl}/faq`} className="hover:opacity-100 transition-opacity">FAQ</a></li>
        </ul>
      </div>
      {/* Policies */}
      <div>
        <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Policies</h3>
        <ul className="space-y-2 text-sm" style={{ color: "color-mix(in srgb, var(--store-text) 60%, transparent)" }}>
          <li><a href={`${storeUrl}/privacy-policy`} className="hover:opacity-100 transition-opacity">Privacy Policy</a></li>
          <li><a href={`${storeUrl}/terms`} className="hover:opacity-100 transition-opacity">Terms of Service</a></li>
          <li><a href={`${storeUrl}/shipping-policy`} className="hover:opacity-100 transition-opacity">Shipping</a></li>
          <li><a href={`${storeUrl}/return-policy`} className="hover:opacity-100 transition-opacity">Returns</a></li>
        </ul>
      </div>
      {/* Account */}
      <div>
        <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Account</h3>
        <ul className="space-y-2 text-sm" style={{ color: "color-mix(in srgb, var(--store-text) 60%, transparent)" }}>
          <li><a href={`/store/${store.slug}/account`} className="hover:opacity-100 transition-opacity">My Account</a></li>
          <li><a href={`/store/${store.slug}/account/orders`} className="hover:opacity-100 transition-opacity">Orders</a></li>
          <li><a href={`/store/${store.slug}/account/wishlist`} className="hover:opacity-100 transition-opacity">Wishlist</a></li>
        </ul>
      </div>
      {/* Newsletter */}
      <div>
        <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Stay Updated</h3>
        <p className="text-sm mb-3" style={{ color: "color-mix(in srgb, var(--store-text) 50%, transparent)" }}>
          Get the latest on new products and deals.
        </p>
        <form className="flex gap-2" onSubmit={(e: React.FormEvent) => e.preventDefault()}>
          <input
            type="email"
            placeholder="Email"
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border bg-transparent"
            style={{
              borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
              color: "var(--store-text)",
            }}
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded-lg text-white shrink-0"
            style={{ backgroundColor: "var(--store-color-primary)" }}
          >
            Join
          </button>
        </form>
      </div>
    </div>
    {/* Bottom bar */}
    <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
      style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 10%, transparent)" }}
    >
      <p className="text-xs" style={{ color: "color-mix(in srgb, var(--store-text) 40%, transparent)" }}>
        &copy; {new Date().getFullYear()} {store.name}. All rights reserved.
      </p>
      <p className="text-xs" style={{ color: "color-mix(in srgb, var(--store-text) 30%, transparent)" }}>
        Powered by <a href="https://flowsmartly.com" className="hover:opacity-100">FlowSmartly</a>
      </p>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/store/[slug]/layout.tsx"
git commit -m "feat(store): expanded branded footer with policies, newsletter, account links"
```

---

## Task 10: Login/Register — Back Navigation + Branding

**Files:**
- Modify: `src/app/store/[slug]/account/login/page.tsx`

- [ ] **Step 1: Add back-to-shop link and store logo above form**

In `src/app/store/[slug]/account/login/page.tsx`, add a back link before the form container. Replace lines 54-68:

```tsx
return (
  <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
    {/* Back to shop */}
    <a
      href={`/stores/${slug}`}
      className="self-start mb-6 inline-flex items-center gap-1.5 text-sm opacity-50 hover:opacity-100 transition-opacity"
      style={{ color: "var(--store-text)" }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      Back to Shop
    </a>

    <div
      className="w-full max-w-md rounded-xl border p-6 sm:p-8"
      style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
    >
      <h1
        className="text-2xl font-bold text-center mb-1"
        style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
      >
        Sign In
      </h1>
      <p className="text-sm text-center opacity-50 mb-6">
        Access your account to track orders and more
      </p>
```

- [ ] **Step 2: Apply same pattern to register page if it exists**

Check `src/app/store/[slug]/account/register/page.tsx` — apply the same "Back to Shop" link at the top.

- [ ] **Step 3: Commit**

```bash
git add "src/app/store/[slug]/account/login/page.tsx" "src/app/store/[slug]/account/register/page.tsx"
git commit -m "feat(store): back-to-shop navigation on login/register pages"
```

---

## Task 11: Account Dashboard — Grid + Order Number Fixes

**Files:**
- Modify: `src/app/store/[slug]/account/page.tsx`

- [ ] **Step 1: Fix quick links grid from 4-col to 3-col on sm**

Find the grid container (has `grid-cols-2 sm:grid-cols-4`):

```tsx
// OLD
className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
// NEW
className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8"
```

- [ ] **Step 2: Add min-height to quick link cards**

Find each quick link card container and add min-height:

```tsx
// OLD
className="rounded-xl border p-5 ...
// NEW
className="rounded-xl border p-5 min-h-[140px] ...
```

- [ ] **Step 3: Truncate order numbers**

Find order number display and add `truncate max-w-[180px]` class.

- [ ] **Step 4: Commit**

```bash
git add "src/app/store/[slug]/account/page.tsx"
git commit -m "fix(store): account dashboard grid layout, order number truncation"
```

---

## Task 12: Orders Page — Mobile Touch Targets

**Files:**
- Modify: `src/app/store/[slug]/account/orders/page.tsx`

- [ ] **Step 1: Enlarge action buttons**

Find "Complete Payment" and "Cancel Order" buttons and increase size:

```tsx
// OLD
className="px-4 py-1.5 rounded-full text-xs font-medium ...
// NEW
className="px-4 py-2.5 rounded-full text-sm font-medium min-w-[120px] ...
```

- [ ] **Step 2: Stack buttons on mobile**

Change the button container from inline to stacked on mobile:

```tsx
// OLD
<div className="text-right shrink-0 flex flex-col items-end gap-2">
// NEW
<div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto mt-3 sm:mt-0">
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/store/[slug]/account/orders/page.tsx"
git commit -m "fix(store): orders page larger buttons, mobile stacking"
```

---

## Task 13: Addresses Page — Branded Delete Modal

**Files:**
- Modify: `src/app/store/[slug]/account/addresses/page.tsx`

- [ ] **Step 1: Replace window.confirm with branded modal**

Add state for the confirm modal at the top of the component:

```tsx
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
```

Replace the `if (!confirm(...))` line:

```tsx
// OLD
if (!confirm("Remove this address?")) return;
// NEW — trigger modal instead
setConfirmDeleteId(addressId);
return;
```

Add the modal JSX before the closing fragment or return:

```tsx
{/* Branded delete confirmation */}
{confirmDeleteId && (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
    <div
      className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
      style={{ backgroundColor: "var(--store-background)", color: "var(--store-text)" }}
    >
      <h2 className="text-lg font-semibold mb-2">Remove Address?</h2>
      <p className="text-sm opacity-60 mb-6">This action cannot be undone.</p>
      <div className="flex gap-3">
        <button
          onClick={() => setConfirmDeleteId(null)}
          className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)" }}
        >
          Keep
        </button>
        <button
          onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
          className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/store/[slug]/account/addresses/page.tsx"
git commit -m "fix(store): branded delete confirmation modal on addresses page"
```

---

## Task 14: Wishlist + Saved Pages — Touch Targets

**Files:**
- Modify: `src/app/store/[slug]/account/wishlist/page.tsx`
- Modify: `src/app/store/[slug]/account/saved/page.tsx`

- [ ] **Step 1: Enlarge wishlist remove button**

In wishlist/page.tsx, find the remove button (has `h-7 w-7`):

```tsx
// OLD
className="... h-7 w-7 ..."
// NEW
className="... h-9 w-9 ..."
```

- [ ] **Step 2: Fix product name from truncate to line-clamp-2**

```tsx
// OLD
className="... truncate ..."
// NEW
className="... line-clamp-2 ..."
```

- [ ] **Step 3: Apply same fixes to saved/page.tsx**

Same pattern — enlarge remove/action buttons, use line-clamp-2 for names.

- [ ] **Step 4: Commit**

```bash
git add "src/app/store/[slug]/account/wishlist/page.tsx" "src/app/store/[slug]/account/saved/page.tsx"
git commit -m "fix(store): larger touch targets on wishlist/saved pages"
```

---

## Task 15: Reference Store Checkout — Mobile Stepper Labels

**Files:**
- Modify: `reference-store/src/app/checkout/page.tsx`

- [ ] **Step 1: Show abbreviated step labels on mobile**

Find the stepper section (around line 551-571). Each step label is hidden on mobile with `hidden sm:inline`. Add abbreviated mobile labels:

```tsx
// OLD pattern for each step label:
<span className="hidden sm:inline">{step.label}</span>

// NEW pattern:
<span className="hidden sm:inline">{step.label}</span>
<span className="sm:hidden text-[10px]">{step.short}</span>
```

Define short labels in the steps array:

```tsx
const steps = [
  { label: "Information", short: "Info", icon: User },
  { label: "Shipping", short: "Ship", icon: Truck },
  ...(hasSavedCards ? [{ label: "Saved Cards", short: "Cards", icon: CreditCard }] : []),
  { label: "Payment", short: "Pay", icon: CreditCard },
];
```

- [ ] **Step 2: Make order summary sticky on tablet**

Find the order summary container (has `lg:sticky lg:top-8`):

```tsx
// OLD
className="... lg:sticky lg:top-8"
// NEW
className="... md:sticky md:top-8"
```

- [ ] **Step 3: Commit**

```bash
git add reference-store/src/app/checkout/page.tsx
git commit -m "feat(store): mobile stepper labels, tablet-sticky order summary"
```

---

## Task 16: FAQ — Single-Open Accordion + Contact CTA

**Files:**
- Modify: `reference-store/src/components/FAQ.tsx`

- [ ] **Step 1: Change accordion to single-open mode**

Find the FAQ component state. Replace the toggle logic:

```tsx
// OLD (likely):
const [openItems, setOpenItems] = useState<Set<number>>(new Set());
const toggle = (i: number) => {
  const next = new Set(openItems);
  if (next.has(i)) next.delete(i); else next.add(i);
  setOpenItems(next);
};

// NEW (single-open):
const [openItem, setOpenItem] = useState<number | null>(null);
const toggle = (i: number) => {
  setOpenItem(openItem === i ? null : i);
};
```

Update the `isOpen` check from `openItems.has(i)` to `openItem === i`.

- [ ] **Step 2: Add "Still have questions?" CTA at bottom**

After the FAQ list, add:

```tsx
<div className="mt-10 text-center py-8 px-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Still have questions?</p>
  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">We're here to help.</p>
  <a
    href={storeUrl("/about")}
    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-full hover:bg-primary-700 transition-colors"
  >
    Contact Us
  </a>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add reference-store/src/components/FAQ.tsx
git commit -m "feat(store): single-open FAQ accordion + contact CTA"
```

---

## Task 17: About Page — Clickable Contacts + Image

**Files:**
- Modify: `reference-store/src/app/about/page.tsx`

- [ ] **Step 1: Make email/phone links clickable**

Find where emails/phones are displayed. Wrap them:

```tsx
// Emails
{storeInfo.emails.map(email => (
  <li key={email}>
    <a href={`mailto:${email}`} className="text-primary-600 hover:underline">{email}</a>
  </li>
))}

// Phones
{storeInfo.phones.map(phone => (
  <li key={phone}>
    <a href={`tel:${phone}`} className="text-primary-600 hover:underline">{phone}</a>
  </li>
))}
```

- [ ] **Step 2: Add hero image if banner exists**

At the top of the about page content, add:

```tsx
{storeInfo.bannerUrl && (
  <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden mb-8">
    <img src={storeInfo.bannerUrl} alt={`About ${storeInfo.name}`} className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add reference-store/src/app/about/page.tsx
git commit -m "feat(store): about page hero image + clickable contacts"
```

---

## Task 18: Final — TypeScript Check + Deploy

**Files:** All modified files

- [ ] **Step 1: Run TypeScript check**

```bash
cd c:/Users/koffi/Dev/flowsmartly && npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors. If errors found, fix them.

- [ ] **Step 2: Commit all remaining changes**

```bash
git add -A
git status
git commit -m "chore: store UI/UX overhaul — all 38 issues fixed"
```

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
ssh flowsmartly "cd /opt/flowsmartly && git stash && git pull origin main && sed -i 's/provider = \"sqlite\"/provider = \"postgresql\"/g' prisma/schema.prisma && npx prisma generate && rm -rf .next node_modules/.cache && NODE_OPTIONS='--max-old-space-size=8192' npx next build --no-lint && pm2 restart flowsmartly"
```

- [ ] **Step 4: Verify deployment**

```bash
ssh flowsmartly "pm2 logs flowsmartly --lines 10 --nostream"
```

Expected: `Ready in` message, no errors.
