import { storeUrl } from "./data";

// ─── Product types ───────────────────────────────────────────────────────────

export interface ProductImage {
  url: string;
  alt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: Record<string, string>; // e.g. { size: "L", color: "Navy" }
  priceCents: number;
  comparePriceCents?: number;
  imageUrl?: string;
  inStock: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  priceCents: number;
  comparePriceCents?: number; // "was" price — shows strikethrough discount
  categoryId: string;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  labels: ("new" | "sale" | "bestseller" | "limited" | "discount" | "featured")[];
  featured: boolean;
  inStock: boolean;
}

// ─── Product catalog ─────────────────────────────────────────────────────────

export const products: Product[] = [
  {
    id: "prod-1",
    slug: "minimalist-desk-lamp",
    name: "Minimalist Desk Lamp",
    shortDescription: "Sleek LED desk lamp with adjustable brightness",
    description: "Illuminate your workspace with this beautifully crafted LED desk lamp. Features three brightness levels, a warm-to-cool color temperature range, and a weighted base that keeps it stable on any surface. The articulating arm lets you direct light exactly where you need it.",
    priceCents: 8900,
    comparePriceCents: 12900,
    categoryId: "cat-home",
    tags: ["lighting", "desk", "office", "led"],
    images: [
      { url: storeUrl("/images/products/desk-lamp-1.jpg"), alt: "Minimalist desk lamp - front view" },
      { url: storeUrl("/images/products/desk-lamp-2.jpg"), alt: "Minimalist desk lamp - side angle" },
    ],
    variants: [
      { id: "v1-white", name: "Matte White", options: { color: "White" }, priceCents: 8900, inStock: true },
      { id: "v1-black", name: "Matte Black", options: { color: "Black" }, priceCents: 8900, inStock: true },
      { id: "v1-brass", name: "Brushed Brass", options: { color: "Brass" }, priceCents: 10900, inStock: true },
    ],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-2",
    slug: "ceramic-planter-set",
    name: "Ceramic Planter Set",
    shortDescription: "Set of 3 handmade ceramic planters",
    description: "Bring nature indoors with this set of three handmade ceramic planters. Each piece is hand-thrown and glazed in earthy tones that complement any interior. Includes drainage holes and matching saucers. Perfect for succulents, herbs, or small houseplants.",
    priceCents: 4500,
    categoryId: "cat-home",
    tags: ["plants", "ceramic", "handmade", "decor"],
    images: [
      { url: storeUrl("/images/products/planter-set-1.jpg"), alt: "Ceramic planter set of 3" },
    ],
    variants: [
      { id: "v2-terracotta", name: "Terracotta", options: { color: "Terracotta" }, priceCents: 4500, inStock: true },
      { id: "v2-sage", name: "Sage Green", options: { color: "Sage" }, priceCents: 4500, inStock: true },
    ],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-3",
    slug: "linen-throw-blanket",
    name: "Linen Throw Blanket",
    shortDescription: "Soft stonewashed linen throw in neutral tones",
    description: "Wrap yourself in luxury with this stonewashed linen throw. Pre-washed for exceptional softness, it drapes beautifully over a sofa or bed. Made from 100% European flax linen — breathable in summer, warm in winter. Machine washable.",
    priceCents: 7900,
    categoryId: "cat-home",
    tags: ["linen", "throw", "blanket", "bedroom", "living-room"],
    images: [
      { url: storeUrl("/images/products/linen-throw-1.jpg"), alt: "Linen throw blanket draped on sofa" },
    ],
    variants: [
      { id: "v3-natural", name: "Natural", options: { color: "Natural" }, priceCents: 7900, inStock: true },
      { id: "v3-charcoal", name: "Charcoal", options: { color: "Charcoal" }, priceCents: 7900, inStock: true },
      { id: "v3-blush", name: "Blush", options: { color: "Blush" }, priceCents: 7900, inStock: false },
    ],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-4",
    slug: "leather-card-wallet",
    name: "Leather Card Wallet",
    shortDescription: "Slim full-grain leather card holder",
    description: "Carry your essentials in style with this slim card wallet. Crafted from full-grain Italian leather that develops a beautiful patina over time. Holds up to 6 cards plus cash in the center slot. Slim enough for your front pocket.",
    priceCents: 3900,
    categoryId: "cat-accessories",
    tags: ["leather", "wallet", "card-holder", "everyday-carry"],
    images: [
      { url: storeUrl("/images/products/card-wallet-1.jpg"), alt: "Leather card wallet - closed" },
      { url: storeUrl("/images/products/card-wallet-2.jpg"), alt: "Leather card wallet - open" },
    ],
    variants: [
      { id: "v4-tan", name: "Tan", options: { color: "Tan" }, priceCents: 3900, inStock: true },
      { id: "v4-black", name: "Black", options: { color: "Black" }, priceCents: 3900, inStock: true },
    ],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-5",
    slug: "canvas-tote-bag",
    name: "Canvas Tote Bag",
    shortDescription: "Heavy-duty organic cotton tote with leather handles",
    description: "The do-everything tote. Made from 18oz organic canvas with reinforced leather handles that feel great in your hand. Interior zip pocket keeps your phone safe. Fits a laptop, groceries, or your gym gear. Gets better with every use.",
    priceCents: 5500,
    comparePriceCents: 6900,
    categoryId: "cat-accessories",
    tags: ["bag", "tote", "canvas", "organic"],
    images: [
      { url: storeUrl("/images/products/tote-bag-1.jpg"), alt: "Canvas tote bag - front" },
    ],
    variants: [
      { id: "v5-natural", name: "Natural Canvas", options: { color: "Natural" }, priceCents: 5500, inStock: true },
      { id: "v5-olive", name: "Olive", options: { color: "Olive" }, priceCents: 5500, inStock: true },
    ],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-6",
    slug: "brass-keychain",
    name: "Brass Keychain",
    shortDescription: "Solid brass key clip with snap hook",
    description: "A keychain that lasts a lifetime. Machined from solid brass with a satisfying weight and smooth action. The snap hook clips securely to belt loops or bag straps. Develops a unique patina as it ages — no two look alike.",
    priceCents: 2200,
    categoryId: "cat-accessories",
    tags: ["keychain", "brass", "everyday-carry", "gift"],
    images: [
      { url: storeUrl("/images/products/keychain-1.jpg"), alt: "Brass keychain" },
    ],
    variants: [],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-7",
    slug: "soy-candle-trio",
    name: "Soy Candle Trio",
    shortDescription: "Set of 3 hand-poured soy candles (cedar, lavender, citrus)",
    description: "Transform your space with these hand-poured soy candles. Each set includes three signature scents: Cedar & Smoke (woody, grounding), French Lavender (floral, calming), and Bright Citrus (energizing, fresh). 40-hour burn time per candle. Clean-burning with cotton wicks.",
    priceCents: 3600,
    categoryId: "cat-wellness",
    tags: ["candle", "soy", "aromatherapy", "gift-set"],
    images: [
      { url: storeUrl("/images/products/candle-trio-1.jpg"), alt: "Soy candle trio in glass jars" },
    ],
    variants: [],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-8",
    slug: "essential-oil-diffuser",
    name: "Essential Oil Diffuser",
    shortDescription: "Ceramic ultrasonic diffuser with ambient lighting",
    description: "Create a spa-like atmosphere at home with this ceramic ultrasonic diffuser. Features a 300ml water tank for up to 8 hours of continuous misting, 7 LED color options, and an auto-shutoff safety feature. Whisper-quiet operation — perfect for bedrooms and offices.",
    priceCents: 4900,
    categoryId: "cat-wellness",
    tags: ["diffuser", "essential-oil", "ceramic", "aromatherapy"],
    images: [
      { url: storeUrl("/images/products/diffuser-1.jpg"), alt: "Ceramic essential oil diffuser" },
    ],
    variants: [
      { id: "v8-white", name: "Stone White", options: { color: "White" }, priceCents: 4900, inStock: true },
      { id: "v8-sand", name: "Desert Sand", options: { color: "Sand" }, priceCents: 4900, inStock: true },
    ],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-9",
    slug: "bamboo-bath-set",
    name: "Bamboo Bath Set",
    shortDescription: "Sustainable bath accessories: tray, brush, soap dish",
    description: "Upgrade your bathroom with this sustainable bamboo set. Includes a bathtub caddy tray, a body brush with natural bristles, and a soap dish. All pieces are made from sustainably harvested bamboo with a water-resistant finish. Makes a perfect housewarming gift.",
    priceCents: 5200,
    comparePriceCents: 6800,
    categoryId: "cat-wellness",
    tags: ["bamboo", "bath", "sustainable", "gift-set"],
    images: [
      { url: storeUrl("/images/products/bath-set-1.jpg"), alt: "Bamboo bath set" },
    ],
    variants: [],
    labels: [],
    featured: false,
    inStock: true,
  },
  {
    id: "prod-10",
    slug: "woven-wall-art",
    name: "Woven Wall Art",
    shortDescription: "Hand-woven macrame wall hanging",
    description: "Add texture and warmth to any room with this hand-woven macrame wall hanging. Crafted from 100% natural cotton rope on a sustainably sourced driftwood dowel. Each piece is unique due to the handmade process. Measures approximately 24\" wide x 36\" long.",
    priceCents: 6500,
    categoryId: "cat-home",
    tags: ["wall-art", "macrame", "handmade", "bohemian"],
    images: [
      { url: storeUrl("/images/products/wall-art-1.jpg"), alt: "Woven macrame wall art" },
    ],
    variants: [],
    labels: [],
    featured: false,
    inStock: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return products.filter(p => p.categoryId === categoryId);
}

export function getFeaturedProducts(): Product[] {
  return products.filter(p => p.featured);
}

export function getDeals(): Product[] {
  return products.filter(p => p.comparePriceCents && p.comparePriceCents > p.priceCents);
}

export function getNewArrivals(): Product[] {
  return products.filter(p => p.labels.includes("new"));
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return products.filter(
    p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
  );
}
