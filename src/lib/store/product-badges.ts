/**
 * Product Badge Derivation
 * Derives display badges from existing product fields — no schema changes needed.
 */

export interface ProductBadge {
  type: "sale" | "new" | "best-seller" | "low-stock";
  label: string;
  color: string;
  bgColor: string;
}

interface BadgeInput {
  createdAt: Date;
  priceCents: number;
  comparePriceCents: number | null;
  orderCount: number;
  trackInventory: boolean;
  quantity: number;
  lowStockThreshold: number;
}

export function deriveProductBadges(product: BadgeInput): ProductBadge[] {
  const badges: ProductBadge[] = [];

  // Sale badge — highest visibility
  if (product.comparePriceCents && product.comparePriceCents > product.priceCents) {
    const pct = Math.round(
      (1 - product.priceCents / product.comparePriceCents) * 100
    );
    badges.push({
      type: "sale",
      label: `-${pct}%`,
      color: "#ffffff",
      bgColor: "#dc2626",
    });
  }

  // New badge — created within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (new Date(product.createdAt) > sevenDaysAgo) {
    badges.push({
      type: "new",
      label: "New",
      color: "#ffffff",
      bgColor: "#2563eb",
    });
  }

  // Best Seller badge
  if (product.orderCount > 5) {
    badges.push({
      type: "best-seller",
      label: "Best Seller",
      color: "#ffffff",
      bgColor: "#d97706",
    });
  }

  // Low Stock badge
  if (
    product.trackInventory &&
    product.quantity > 0 &&
    product.quantity <= product.lowStockThreshold
  ) {
    badges.push({
      type: "low-stock",
      label: `Only ${product.quantity} left`,
      color: "#ffffff",
      bgColor: "#ea580c",
    });
  }

  return badges;
}

export function calculateSalePercentage(
  priceCents: number,
  comparePriceCents: number | null
): number | null {
  if (!comparePriceCents || comparePriceCents <= priceCents) return null;
  return Math.round((1 - priceCents / comparePriceCents) * 100);
}
