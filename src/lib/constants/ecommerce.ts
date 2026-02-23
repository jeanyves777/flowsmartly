/**
 * E-Commerce (FlowShop) constants — payment methods, categories, statuses, templates.
 */

import { STORE_TEMPLATES_SIMPLE } from "./store-templates";

// ── Types ──

export interface PaymentMethodConfig {
  methodType: string;
  provider: string | null;
  label: string;
  icon: string; // Lucide icon name
}

export interface OrderStatusConfig {
  label: string;
  color: string; // Tailwind color class
  allowedTransitions: string[];
}

export interface DeliveryStatusConfig {
  label: string;
  color: string;
  allowedTransitions: string[];
}

export interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // Best suited for
}

export interface ProductCategoryOption {
  id: string;
  label: string;
}

// ── Payment Methods by Region ──

export const PAYMENT_METHODS_BY_REGION: Record<string, PaymentMethodConfig[]> = {
  north_america: [
    { methodType: "card", provider: "stripe", label: "Credit/Debit Card", icon: "CreditCard" },
    { methodType: "apple_pay", provider: "stripe", label: "Apple Pay", icon: "Smartphone" },
    { methodType: "google_pay", provider: "stripe", label: "Google Pay", icon: "Smartphone" },
  ],
  europe: [
    { methodType: "card", provider: "stripe", label: "Credit/Debit Card", icon: "CreditCard" },
    { methodType: "apple_pay", provider: "stripe", label: "Apple Pay", icon: "Smartphone" },
    { methodType: "google_pay", provider: "stripe", label: "Google Pay", icon: "Smartphone" },
    { methodType: "bank_transfer", provider: "stripe", label: "Bank Transfer (SEPA)", icon: "Building" },
  ],
  west_africa: [
    { methodType: "mobile_money", provider: "orange_money", label: "Orange Money", icon: "Smartphone" },
    { methodType: "mobile_money", provider: "mtn_momo", label: "MTN MoMo", icon: "Smartphone" },
    { methodType: "mobile_money", provider: "wave", label: "Wave", icon: "Smartphone" },
    { methodType: "mobile_money", provider: "flutterwave", label: "Flutterwave", icon: "Smartphone" },
    { methodType: "cod", provider: null, label: "Cash on Delivery", icon: "Banknote" },
    { methodType: "bank_transfer", provider: "paystack", label: "Bank Transfer", icon: "Building" },
  ],
  east_africa: [
    { methodType: "mobile_money", provider: "mpesa", label: "M-Pesa", icon: "Smartphone" },
    { methodType: "mobile_money", provider: "flutterwave", label: "Flutterwave", icon: "Smartphone" },
    { methodType: "cod", provider: null, label: "Cash on Delivery", icon: "Banknote" },
  ],
  south_africa_region: [
    { methodType: "card", provider: "paystack", label: "Credit/Debit Card", icon: "CreditCard" },
    { methodType: "mobile_money", provider: "paystack", label: "Mobile Money", icon: "Smartphone" },
    { methodType: "cod", provider: null, label: "Cash on Delivery", icon: "Banknote" },
    { methodType: "bank_transfer", provider: "paystack", label: "Bank Transfer (EFT)", icon: "Building" },
  ],
  middle_east: [
    { methodType: "card", provider: "stripe", label: "Credit/Debit Card", icon: "CreditCard" },
    { methodType: "cod", provider: null, label: "Cash on Delivery", icon: "Banknote" },
    { methodType: "bank_transfer", provider: "stripe", label: "Bank Transfer", icon: "Building" },
  ],
  asia_pacific: [
    { methodType: "card", provider: "stripe", label: "Credit/Debit Card", icon: "CreditCard" },
    { methodType: "mobile_money", provider: "stripe", label: "Digital Wallet", icon: "Smartphone" },
    { methodType: "cod", provider: null, label: "Cash on Delivery", icon: "Banknote" },
  ],
  caribbean_latam: [
    { methodType: "mobile_money", provider: "flutterwave", label: "Mobile Money", icon: "Smartphone" },
    { methodType: "cod", provider: null, label: "Cash on Delivery", icon: "Banknote" },
    { methodType: "bank_transfer", provider: "flutterwave", label: "Bank Transfer", icon: "Building" },
  ],
};

/** Regions that support Cash on Delivery — these need delivery driver tracking */
export const COD_REGIONS = [
  "west_africa",
  "east_africa",
  "south_africa_region",
  "middle_east",
  "asia_pacific",
  "caribbean_latam",
];

/** Check if a region supports COD/driver tracking */
export function regionSupportsCOD(regionId: string | null | undefined): boolean {
  return regionId ? COD_REGIONS.includes(regionId) : false;
}

// ── Product Categories ──

export const PRODUCT_CATEGORIES: ProductCategoryOption[] = [
  { id: "clothing", label: "Clothing & Apparel" },
  { id: "electronics", label: "Electronics" },
  { id: "food", label: "Food & Beverages" },
  { id: "health", label: "Health & Beauty" },
  { id: "home", label: "Home & Garden" },
  { id: "jewelry", label: "Jewelry & Accessories" },
  { id: "sports", label: "Sports & Outdoors" },
  { id: "toys", label: "Toys & Games" },
  { id: "digital", label: "Digital Products" },
  { id: "services", label: "Services" },
  { id: "art", label: "Art & Crafts" },
  { id: "books", label: "Books & Media" },
  { id: "automotive", label: "Automotive" },
  { id: "pets", label: "Pets & Animals" },
  { id: "other", label: "Other" },
];

// ── Order Statuses ──

export const ORDER_STATUSES: Record<string, OrderStatusConfig> = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    allowedTransitions: ["CONFIRMED", "CANCELLED"],
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    allowedTransitions: ["PROCESSING", "CANCELLED"],
  },
  PROCESSING: {
    label: "Processing",
    color: "bg-indigo-100 text-indigo-800",
    allowedTransitions: ["SHIPPED", "CANCELLED"],
  },
  SHIPPED: {
    label: "Shipped",
    color: "bg-purple-100 text-purple-800",
    allowedTransitions: ["DELIVERED"],
  },
  DELIVERED: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    allowedTransitions: ["REFUNDED"],
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    allowedTransitions: [],
  },
  REFUNDED: {
    label: "Refunded",
    color: "bg-gray-100 text-gray-800",
    allowedTransitions: [],
  },
};

/** Validate if a status transition is allowed */
export function isValidOrderTransition(from: string, to: string): boolean {
  const config = ORDER_STATUSES[from];
  return config ? config.allowedTransitions.includes(to) : false;
}

// ── Delivery Statuses ──

export const DELIVERY_STATUSES: Record<string, DeliveryStatusConfig> = {
  assigned: {
    label: "Assigned",
    color: "bg-blue-100 text-blue-800",
    allowedTransitions: ["picked_up", "failed"],
  },
  picked_up: {
    label: "Picked Up",
    color: "bg-indigo-100 text-indigo-800",
    allowedTransitions: ["in_transit", "failed"],
  },
  in_transit: {
    label: "In Transit",
    color: "bg-purple-100 text-purple-800",
    allowedTransitions: ["delivered", "failed"],
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    allowedTransitions: [],
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800",
    allowedTransitions: ["assigned"], // Can be re-assigned
  },
};

export function isValidDeliveryTransition(from: string, to: string): boolean {
  const config = DELIVERY_STATUSES[from];
  return config ? config.allowedTransitions.includes(to) : false;
}

// ── Store Templates (re-exported from store-templates.ts) ──

export const STORE_TEMPLATES: StoreTemplate[] = STORE_TEMPLATES_SIMPLE;

// ── Currencies by Region ──

export const CURRENCIES_BY_REGION: Record<string, { code: string; symbol: string; name: string }> = {
  north_america: { code: "USD", symbol: "$", name: "US Dollar" },
  europe: { code: "EUR", symbol: "\u20AC", name: "Euro" },
  west_africa: { code: "XOF", symbol: "CFA", name: "CFA Franc (BCEAO)" },
  east_africa: { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  south_africa_region: { code: "ZAR", symbol: "R", name: "South African Rand" },
  middle_east: { code: "AED", symbol: "AED", name: "UAE Dirham" },
  asia_pacific: { code: "USD", symbol: "$", name: "US Dollar" },
  caribbean_latam: { code: "USD", symbol: "$", name: "US Dollar" },
};

export function getCurrencyForRegion(regionId: string | null | undefined): { code: string; symbol: string; name: string } {
  if (!regionId) return { code: "USD", symbol: "$", name: "US Dollar" };
  return CURRENCIES_BY_REGION[regionId] || { code: "USD", symbol: "$", name: "US Dollar" };
}

// ── Subscription Pricing ──

export const ECOM_SUBSCRIPTION_PRICE_CENTS = 500; // $5/month

// ── Slug Generation ──

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Order Number Generation ──

export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${year}-${rand}${suffix}`;
}
