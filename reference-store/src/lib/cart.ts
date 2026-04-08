/**
 * Cart state management using localStorage.
 * This is a client-side only module — no server-side rendering.
 *
 * CRITICAL: Checkout redirects to the main FlowSmartly app (SSR) since
 * static export cannot handle payment processing.
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

const CART_KEY = "flowshop-cart-example-store"; // slug-specific key

// ─── Cart operations ─────────────────────────────────────────────────────────

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
  // Dispatch custom event so CartDrawer/CartButton re-render
  window.dispatchEvent(new CustomEvent("cart-updated"));
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity: number = 1): void {
  const cart = getCart();
  const key = item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
  const existing = cart.find(
    i => (i.variantId ? `${i.productId}:${i.variantId}` : i.productId) === key
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
  const key = variantId ? `${productId}:${variantId}` : productId;
  saveCart(cart.filter(i => (i.variantId ? `${i.productId}:${i.variantId}` : i.productId) !== key));
}

export function updateQuantity(productId: string, variantId: string | undefined, quantity: number): void {
  const cart = getCart();
  const key = variantId ? `${productId}:${variantId}` : productId;
  const item = cart.find(i => (i.variantId ? `${i.productId}:${i.variantId}` : i.productId) === key);

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

// ─── Checkout redirect ───────────────────────────────────────────────────────

/**
 * Encode cart as base64 and redirect to the main FlowSmartly checkout page.
 * The SSR checkout page decodes the cart and handles payment processing.
 */
export function redirectToCheckout(storeSlug: string): void {
  const cart = getCart();
  if (cart.length === 0) return;

  const encoded = btoa(JSON.stringify(cart));
  const baseUrl = window.location.origin.includes("localhost")
    ? "http://localhost:3000"
    : "https://flowsmartly.com";

  window.location.href = `${baseUrl}/store/${storeSlug}/checkout?cart=${encoded}`;
}
