import Link from "next/link";
import Image from "next/image";
import { deriveProductBadges, type ProductBadge } from "@/lib/store/product-badges";
import { QuickAddButton } from "./quick-add-button";

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  comparePriceCents: number | null;
  currency: string;
  images: string | null;
  shortDescription: string | null;
  createdAt: Date;
  orderCount: number;
  trackInventory: boolean;
  quantity: number;
  lowStockThreshold: number;
}

interface ProductCardProps {
  product: ProductCardData;
  storeSlug: string;
  primaryColor?: string;
  cardStyle?: string;
  formatPrice: (cents: number, currency: string) => string;
}

function getCardClasses(cardStyle: string): string {
  switch (cardStyle) {
    case "rounded":
      return "rounded-xl p-2 bg-white/50";
    case "sharp":
      return "rounded-none";
    case "shadow":
      return "rounded-lg shadow-md hover:shadow-xl transition-shadow";
    case "bordered":
      return "rounded-lg border hover:border-gray-300 transition-colors";
    case "minimal":
    default:
      return "rounded-lg";
  }
}

function getImageClasses(cardStyle: string): string {
  switch (cardStyle) {
    case "rounded":
      return "rounded-xl";
    case "sharp":
      return "rounded-none";
    default:
      return "rounded-lg";
  }
}

export function ProductCard({
  product,
  storeSlug,
  primaryColor,
  cardStyle = "minimal",
  formatPrice,
}: ProductCardProps) {
  const images = JSON.parse(product.images || "[]") as {
    url: string;
    alt?: string;
  }[];
  const mainImage = images[0];
  const badges = deriveProductBadges(product);
  const cardCls = getCardClasses(cardStyle);
  const imageCls = getImageClasses(cardStyle);

  return (
    <Link
      href={`/store/${storeSlug}/products/${product.slug}`}
      className={`group relative ${cardCls}`}
    >
      {/* Image + Badges + Quick Add */}
      <div className={`relative aspect-square overflow-hidden bg-gray-100 mb-3 ${imageCls}`}>
        {mainImage ? (
          <Image
            src={mainImage.url}
            alt={mainImage.alt || product.name}
            width={400}
            height={400}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg
              className="w-12 h-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {badges.slice(0, 2).map((badge) => (
              <span
                key={badge.type}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shadow-sm"
                style={{
                  color: badge.color,
                  backgroundColor: badge.bgColor,
                }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* Quick Add Button */}
        <QuickAddButton
          productId={product.id}
          productName={product.name}
          priceCents={product.priceCents}
          currency={product.currency}
          imageUrl={mainImage?.url}
        />
      </div>

      {/* Product Info */}
      <h3 className="text-sm font-medium group-hover:underline line-clamp-2 leading-tight">
        {product.name}
      </h3>

      {/* Pricing */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-sm font-bold" style={{ color: 'var(--store-primary)' }}>
          {formatPrice(product.priceCents, product.currency)}
        </span>
        {product.comparePriceCents &&
          product.comparePriceCents > product.priceCents && (
            <span className="text-xs line-through text-gray-400">
              {formatPrice(product.comparePriceCents, product.currency)}
            </span>
          )}
      </div>

      {/* Short description on larger cards */}
      {product.shortDescription && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-1 hidden sm:block">
          {product.shortDescription}
        </p>
      )}
    </Link>
  );
}
