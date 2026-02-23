/**
 * FlowShop Cart System
 * Client-side cart with localStorage persistence.
 * Types and pure utility functions (no React dependencies).
 */

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
  maxQuantity?: number;
  currency: string;
}

export interface ShippingConfig {
  flatRateCents?: number;
  freeShippingThresholdCents?: number;
  localPickup?: boolean;
}

export function getCartKey(storeSlug: string): string {
  return `flowshop-cart-${storeSlug}`;
}

export function loadCart(storeSlug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getCartKey(storeSlug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(storeSlug: string, items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getCartKey(storeSlug), JSON.stringify(items));
}

export function clearCartStorage(storeSlug: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getCartKey(storeSlug));
}

export function addItemToCart(items: CartItem[], newItem: CartItem): CartItem[] {
  const existingIdx = items.findIndex(
    (i) => i.productId === newItem.productId && i.variantId === newItem.variantId
  );

  if (existingIdx >= 0) {
    const updated = [...items];
    const existing = updated[existingIdx];
    const newQty = existing.quantity + newItem.quantity;
    updated[existingIdx] = {
      ...existing,
      quantity: existing.maxQuantity ? Math.min(newQty, existing.maxQuantity) : newQty,
    };
    return updated;
  }

  return [...items, newItem];
}

export function removeItemFromCart(
  items: CartItem[],
  productId: string,
  variantId?: string
): CartItem[] {
  return items.filter(
    (i) => !(i.productId === productId && i.variantId === variantId)
  );
}

export function updateItemQuantity(
  items: CartItem[],
  productId: string,
  variantId: string | undefined,
  quantity: number
): CartItem[] {
  if (quantity <= 0) return removeItemFromCart(items, productId, variantId);
  return items.map((i) => {
    if (i.productId === productId && i.variantId === variantId) {
      const newQty = i.maxQuantity ? Math.min(quantity, i.maxQuantity) : quantity;
      return { ...i, quantity: newQty };
    }
    return i;
  });
}

export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateShipping(
  subtotalCents: number,
  config: ShippingConfig | null | undefined,
  shippingMethod?: string
): number {
  if (!config) return 0;
  if (shippingMethod === "local_pickup" && config.localPickup) return 0;
  if (
    config.freeShippingThresholdCents &&
    config.freeShippingThresholdCents > 0 &&
    subtotalCents >= config.freeShippingThresholdCents
  ) {
    return 0;
  }
  return config.flatRateCents || 0;
}

export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
