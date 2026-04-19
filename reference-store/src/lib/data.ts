// ─── Base URL helper (CRITICAL: agent MUST use storeUrl() for ALL internal links) ───

export const STORE_BASE = '/stores/example-store';
export function storeUrl(path: string): string {
  return STORE_BASE + path;
}

// ─── Store info ──────────────────────────────────────────────────────────────

export const storeInfo = {
  name: "Example Store",
  shortName: "ExStore",
  tagline: "Premium goods, delivered with care",
  description: "We curate the finest selection of lifestyle products for modern living.",
  about: "Founded in 2024, Example Store brings together quality craftsmanship and modern design. We believe in products that tell a story — each item in our collection is carefully sourced from independent makers and ethical suppliers worldwide.",
  mission: "To make exceptional design accessible to everyone.",
  currency: "USD",
  region: "US",
  logoUrl: storeUrl("/images/brand/logo.png"),
  bannerUrl: storeUrl("/images/hero/banner.jpg"),
  favicon: storeUrl("/images/brand/logo.png"),
  address: "123 Commerce St, New York, NY 10001",
  phones: ["+1 (555) 123-4567"],
  emails: ["hello@examplestore.com"],
  website: "https://examplestore.com",
  accountUrl: "https://flowsmartly.com/store/example-store/account",
  websiteUrl: "", // populated by agent if user has a website
  ctaText: "Shop Now",
  ctaUrl: storeUrl("/products"),
  flatRateShippingCents: 599,          // default flat-rate shipping cost
  freeShippingThresholdCents: 5000,    // 0 = disabled; >0 = free shipping above this amount
  socialLinks: {
    instagram: "https://instagram.com/examplestore",
    facebook: "https://facebook.com/examplestore",
    tiktok: "",
    twitter: "",
  },
};

// ─── Currency formatting ─────────────────────────────────────────────────────

const CURRENCY_FORMATS: Record<string, { symbol: string; locale: string; divisor: number }> = {
  USD: { symbol: "$", locale: "en-US", divisor: 100 },
  EUR: { symbol: "\u20AC", locale: "fr-FR", divisor: 100 },
  GBP: { symbol: "\u00A3", locale: "en-GB", divisor: 100 },
  XOF: { symbol: "CFA", locale: "fr-FR", divisor: 1 },
  NGN: { symbol: "\u20A6", locale: "en-NG", divisor: 100 },
  KES: { symbol: "KSh", locale: "en-KE", divisor: 100 },
};

export function formatPrice(cents: number, currency?: string): string {
  const cur = currency || storeInfo.currency;
  const fmt = CURRENCY_FORMATS[cur] || CURRENCY_FORMATS.USD;
  const amount = cents / fmt.divisor;
  return new Intl.NumberFormat(fmt.locale, {
    style: "currency",
    currency: cur,
    minimumFractionDigits: cur === "XOF" ? 0 : 2,
  }).format(amount);
}

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = [
  {
    id: "cat-home",
    name: "Home & Living",
    slug: "home-living",
    description: "Elevate your space with curated home essentials",
    image: storeUrl("/images/categories/home.jpg"),
    productCount: 4,
  },
  {
    id: "cat-accessories",
    name: "Accessories",
    slug: "accessories",
    description: "Everyday carry, refined",
    image: storeUrl("/images/categories/accessories.jpg"),
    productCount: 3,
  },
  {
    id: "cat-wellness",
    name: "Wellness",
    slug: "wellness",
    description: "Self-care essentials for mind and body",
    image: storeUrl("/images/categories/wellness.jpg"),
    productCount: 3,
  },
];

// ─── Shipping methods ─────────────────────────────────────────────────────────
// Agent MUST replace these with the store owner's actual shipping methods from DB

export const shippingMethods = [
  {
    id: "standard",
    name: "Standard Shipping",
    description: "5-7 business days",
    priceCents: 599,
    estimatedDays: "5-7 days",
    isActive: true,
  },
  {
    id: "express",
    name: "Express Shipping",
    description: "2-3 business days",
    priceCents: 1299,
    estimatedDays: "2-3 days",
    isActive: true,
  },
];

// ─── Navigation ──────────────────────────────────────────────────────────────

export const navLinks = [
  { href: storeUrl("/"), label: "Home" },
  { href: storeUrl("/products"), label: "Shop" },
  { href: storeUrl("/about"), label: "About" },
  { href: storeUrl("/faq"), label: "FAQ" },
];

export const footerLinks = [
  ...navLinks,
  { href: storeUrl("/shipping-policy"), label: "Shipping Policy" },
  { href: storeUrl("/return-policy"), label: "Return Policy" },
  { href: storeUrl("/privacy-policy"), label: "Privacy Policy" },
  { href: storeUrl("/terms"), label: "Terms & Conditions" },
];

// ─── Hero config ─────────────────────────────────────────────────────────────

export const heroConfig = {
  style: "slideshow" as const, // "gradient" | "image" | "slideshow" | "video"
  headline: "Curated for modern living",
  subheadline: "Discover thoughtfully designed products that blend form and function.",
  ctaText: "Browse Collection",
  ctaUrl: storeUrl("/products"),
  // Slideshow source — agent MUST populate with 3-5 downloaded images.
  // The Hero component auto-rotates every 5.5s, pauses on hover, with dot
  // indicators and prev/next arrows. Falls back to backgroundImage if empty.
  slides: [
    storeUrl("/images/hero/banner.jpg"),
  ] as string[],
  backgroundImage: storeUrl("/images/hero/banner.jpg"),
  overlayOpacity: 0.55,
};

// ─── Section order ───────────────────────────────────────────────────────────

export const sectionOrder = [
  "hero",
  "categories",
  "featured",
  "newArrivals",
  "deals",
  "about",
  "newsletter",
] as const;

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export const faq = [
  {
    question: "How long does shipping take?",
    answer: "Standard shipping takes 3-5 business days within the US. Express shipping (1-2 days) is available at checkout.",
  },
  {
    question: "What is your return policy?",
    answer: "We accept returns within 30 days of purchase. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.",
  },
  {
    question: "Do you ship internationally?",
    answer: "Yes! We ship to over 50 countries. International shipping typically takes 7-14 business days.",
  },
  {
    question: "How can I track my order?",
    answer: "Once your order ships, you will receive a tracking number via email. You can also check your order status on our website.",
  },
  {
    question: "Are your products sustainable?",
    answer: "We prioritize working with ethical suppliers who use sustainable materials and practices. Each product page includes details about sourcing.",
  },
];

// ─── Policies (used for policy pages) ────────────────────────────────────────

export const policies = {
  shipping: `<h2>Shipping Policy</h2>
<p><strong>${storeInfo.name}</strong> offers the following shipping options:</p>
<ul>
<li><strong>Standard Shipping:</strong> 3-5 business days ($4.99, free on orders over $50)</li>
<li><strong>Express Shipping:</strong> 1-2 business days ($12.99)</li>
<li><strong>International Shipping:</strong> 7-14 business days (rates calculated at checkout)</li>
</ul>
<p>All orders are processed within 1-2 business days. You will receive a tracking number via email once your order ships.</p>`,

  returns: `<h2>Return Policy</h2>
<p>At <strong>${storeInfo.name}</strong>, we want you to love your purchase. If you are not satisfied, you may return most items within 30 days for a full refund.</p>
<h3>Conditions</h3>
<ul>
<li>Items must be unused, unworn, and in original packaging</li>
<li>Sale items are final sale and cannot be returned</li>
<li>Return shipping costs are the responsibility of the customer</li>
</ul>
<p>To initiate a return, contact us at <a href="mailto:${storeInfo.emails[0]}">${storeInfo.emails[0]}</a>.</p>`,

  privacy: `<h2>Privacy Policy</h2>
<p><strong>${storeInfo.name}</strong> respects your privacy. This policy describes how we collect, use, and protect your personal information.</p>
<h3>Information We Collect</h3>
<ul>
<li>Name, email, and shipping address when you place an order</li>
<li>Payment information (processed securely via Stripe)</li>
<li>Browsing data via cookies for analytics</li>
</ul>
<h3>How We Use Your Information</h3>
<p>We use your information solely to process orders, communicate about your purchases, and improve our services. We never sell your data to third parties.</p>`,

  terms: `<h2>Terms & Conditions</h2>
<p>By using <strong>${storeInfo.name}</strong>, you agree to these terms.</p>
<h3>Orders</h3>
<p>All orders are subject to availability. We reserve the right to cancel orders due to pricing errors or stock issues.</p>
<h3>Intellectual Property</h3>
<p>All content on this site (images, text, logos) is owned by ${storeInfo.name} and may not be reproduced without permission.</p>
<h3>Limitation of Liability</h3>
<p>${storeInfo.name} is not liable for any indirect, incidental, or consequential damages arising from use of this site or products.</p>`,
};
