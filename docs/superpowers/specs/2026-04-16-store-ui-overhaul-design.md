# Store UI/UX Overhaul Design Spec

**Date**: 2026-04-16
**Scope**: Reference-store templates + main app store pages
**Goal**: Mobile-first, branded, polished e-commerce storefront

---

## Problem Statement

The store UI has 38 identified issues spanning broken mobile UX, unbranded components, bare policy/footer pages, spacing inconsistencies, and missing dark mode support. The stores look generic and have critical mobile usability gaps (e.g., no add-to-cart on ProductCard, invisible checkout paths).

---

## Phase 1: Critical Mobile UX Fixes (Reference Store)

### 1.1 ProductCard — Visible Add-to-Cart on Mobile
- Replace hover-only `opacity-0 group-hover:opacity-100` with always-visible button on mobile
- Desktop keeps hover behavior; mobile shows compact "Add to Cart" button below price
- Pattern: `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`
- Enlarge wishlist button: `p-2` -> `p-2.5` (32px touch target)
- Product name: `line-clamp-2 sm:line-clamp-1` for mobile readability

### 1.2 ProductGrid — Mobile-Optimized Spacing
- Gap: `gap-3 sm:gap-4 md:gap-6` (tighter on mobile)
- Filter panel: full-screen modal on mobile instead of inline collapse

### 1.3 MobileBottomNav Fixes
- Labels: `text-[10px]` -> `text-[11px]` minimum
- Search: dispatch `open-search` event instead of navigating to /products
- Account: dispatch `toggle-account` event instead of external link
- Cart badge: use `var(--store-color-primary)` instead of hardcoded `bg-red-500`

### 1.4 CartDrawer — Dark Mode + Theme Integration
- Replace all hardcoded `bg-white` / `border-gray-200` with CSS custom properties
- Add dark mode variants: `dark:bg-gray-900 dark:border-gray-700`
- Z-index: `z-50` -> `z-[60]` (above mobile nav)
- Quantity buttons: `w-7 h-7` -> `w-9 h-9` (36px touch target)
- "Continue Shopping" button: navigate to store home instead of just closing
- Only remove saved-for-later item on API success (already fixed in audit)

### 1.5 Checkout — Mobile Stepper Labels
- Show abbreviated labels on mobile: "Info", "Ship", "Pay" instead of hiding them
- Pattern: `<span className="hidden sm:inline">{fullLabel}</span><span className="sm:hidden">{shortLabel}</span>`
- Order summary: `md:sticky` instead of only `lg:sticky`

---

## Phase 2: Footer Overhaul

### 2.1 Reference Store Footer
Current: 4-column grid with brand, links, legal, contact. Missing newsletter.

**New structure (mobile-first)**:
```
[Brand + Tagline + Social Icons]
[Quick Links (2-col grid)]     [Policies (2-col grid)]
[Newsletter signup]
[Copyright + Powered by FlowSmartly]
```

- Add newsletter signup section
- Social links with proper icons (Instagram, Facebook, Twitter/X, TikTok)
- Logo fallback to store name text (match Header pattern)
- Mobile: single column stack; Desktop: 4-column grid
- Add `href="tel:"` and `href="mailto:"` for contact info

### 2.2 Main App Store Layout Footer
Current: 3 lines — copyright, 3 links, "Powered by" (bare minimum).

**Expand to include**:
- Policy links: Privacy Policy, Terms, Shipping Policy, Return Policy
- Social links from store data
- Contact info (email, phone)
- Newsletter signup
- Proper grid layout matching reference-store footer quality
- Dark mode support with CSS custom properties

---

## Phase 3: Policy & Notice Pages — Branded Redesign

### 3.1 PolicyPage Component Redesign
Current: Plain `prose` text with max-w-3xl container. Generic, unbranded.

**New design**:
- Branded header with store logo, page title, gradient accent bar using `var(--store-color-primary)`
- "Last updated" from actual date (passed as prop), not `new Date()`
- Table of contents sidebar on desktop (sticky), collapsed accordion on mobile
- Breadcrumb navigation: Home > Privacy Policy
- Back-to-shop button at bottom
- Consistent section styling with numbered headings
- Mobile: full-width with `px-4`, larger paragraph text `text-base`
- Dark mode: `prose-invert` with proper link colors

### 3.2 Individual Policy Pages
All 4 pages (privacy-policy, terms, shipping-policy, return-policy) use PolicyPage component.

**Enhancements per page**:
- **Privacy Policy**: Add icon header (Shield icon), sections for data collection, cookies, third parties
- **Terms of Service**: Add icon header (FileText icon), clear numbered sections
- **Shipping Policy**: Add icon header (Truck icon), delivery timeline table, shipping zones
- **Return Policy**: Add icon header (RotateCcw icon), step-by-step return process, refund timeline

### 3.3 About Page
- Add hero image section (store banner or dedicated about image)
- Make contact info clickable (`tel:`, `mailto:`)
- Add team/mission visual section
- Responsive: image full-width on mobile, side-by-side on desktop

### 3.4 FAQ Page
- Keep accordion pattern
- Add search/filter for FAQ items
- Allow only 1 accordion open at a time on mobile (saves scroll space)
- Add "Still have questions? Contact us" CTA at bottom

---

## Phase 4: Account Flow Polish

### 4.1 Login/Register — Back Navigation + Branding
- Add "Back to Shop" link with ArrowLeft icon at top
- Store logo above the form for brand recognition
- Google OAuth button styled to match store theme
- Turnstile loading state: "Verifying you're human..." text while loading
- Error state if Turnstile fails to load

### 4.2 Account Dashboard — Responsive Grid
- Quick links grid: `grid-cols-2 sm:grid-cols-3` (not 4 on sm)
- Add `min-h-[140px]` to cards for consistent heights
- Truncate long order numbers with `truncate` class

### 4.3 Orders Page — Mobile Touch Targets
- Buttons: `py-1.5 text-xs` -> `py-2.5 text-sm min-w-[120px]`
- Mobile layout: stack buttons below order info instead of beside it
- Pattern: `flex flex-col sm:flex-row sm:items-end sm:justify-between`

### 4.4 Addresses — Branded Delete Confirmation
- Replace `window.confirm()` with branded modal overlay
- Modal matches store theme colors
- Proper "Keep" / "Remove" button pair

### 4.5 Wishlist/Saved — Touch Targets
- Remove button: `h-7 w-7` -> `h-9 w-9` (36px)
- Product name: `truncate` -> `line-clamp-2`
- Gap: consistent `gap-3 sm:gap-4`

### 4.6 Complete Profile
- Add optional profile picture upload
- Better form layout with section headers

---

## Phase 5: Global Consistency

### 5.1 CSS Custom Properties (Theming)
All store components MUST use these CSS variables (already set in layout.tsx):
- `--store-color-primary` — buttons, links, accents
- `--store-color-secondary` — secondary elements
- `--store-background` — page background
- `--store-text` — text color

NO hardcoded colors allowed in store components.

### 5.2 Touch Target Standard
Minimum touch target: 36px (9mm) for all interactive elements.
Ideal: 44px (11mm) for primary actions.

### 5.3 Spacing Standard
- Page padding: `px-4 sm:px-6 lg:px-8`
- Section spacing: `py-12 lg:py-16`
- Grid gap: `gap-3 sm:gap-4 md:gap-6`
- All pages with MobileBottomNav: add `pb-20` for bottom clearance

### 5.4 Dark Mode
Every component must have `dark:` variants for:
- Background colors
- Text colors
- Border colors
- Shadow colors

### 5.5 Mobile Nav Path Fixes
- All links in store-client-shell and mobile-nav must use `/stores/${slug}` prefix (nginx route)
- NOT `/store/${slug}` (which is the main app redirect route)

---

## Files to Modify

### Reference Store (templates cloned per store)
1. `reference-store/src/components/Header.tsx` — ThemeToggle import fix
2. `reference-store/src/components/Footer.tsx` — full redesign with newsletter
3. `reference-store/src/components/ProductCard.tsx` — mobile add-to-cart
4. `reference-store/src/components/ProductGrid.tsx` — mobile spacing
5. `reference-store/src/components/MobileBottomNav.tsx` — labels, search, account
6. `reference-store/src/components/CartDrawer.tsx` — dark mode, touch targets
7. `reference-store/src/components/PolicyPage.tsx` — branded redesign
8. `reference-store/src/components/FAQ.tsx` — single-open accordion
9. `reference-store/src/app/layout.tsx` — CREATE: root layout with meta, fonts, theme
10. `reference-store/src/app/about/page.tsx` — image, clickable contacts
11. `reference-store/src/app/checkout/page.tsx` — stepper labels, sticky summary

### Main App Store Pages
12. `src/components/store/cart-drawer.tsx` — dark mode, z-index, touch targets
13. `src/components/store/store-client-shell.tsx` — path fixes, dark mode
14. `src/components/store/mobile-nav.tsx` — path fixes
15. `src/app/store/[slug]/layout.tsx` — expanded footer
16. `src/app/store/[slug]/account/login/page.tsx` — back nav, branding
17. `src/app/store/[slug]/account/orders/page.tsx` — mobile buttons
18. `src/app/store/[slug]/account/addresses/page.tsx` — branded delete modal
19. `src/app/store/[slug]/account/wishlist/page.tsx` — touch targets
20. `src/app/store/[slug]/account/saved/page.tsx` — touch targets
21. `src/app/store/[slug]/account/page.tsx` — grid fixes

### New Files
22. `reference-store/src/app/layout.tsx` — root layout (CREATE)
23. `reference-store/src/components/ThemeToggle.tsx` — if missing (CREATE or verify template)

---

## Success Criteria

1. Every store page looks branded and professional on a 375px iPhone SE
2. All touch targets >= 36px
3. Dark mode works on every component
4. Policy pages have branded headers, TOC, breadcrumbs
5. Footer has newsletter, social links, policy links, contact info
6. Add-to-cart is accessible in 1 tap on mobile ProductCard
7. No hardcoded colors in any store component
8. Cart drawer overlays correctly above mobile nav
9. Login/Register have back navigation to store
10. No `window.confirm()` anywhere in store pages
