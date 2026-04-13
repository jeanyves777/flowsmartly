import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyCustomerToken } from "@/lib/store/customer-auth";
import { prisma } from "@/lib/db/client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WishlistPage({ params }: PageProps) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("sc_session")?.value;
  if (!token) redirect(`/store/${slug}/account/login`);

  const payload = await verifyCustomerToken(token);
  if (!payload) redirect(`/store/${slug}/account/login`);

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, currency: true },
  });
  if (!store || payload.storeId !== store.id) redirect(`/store/${slug}/account/login`);

  const wishlistItems = await prisma.storeWishlistItem.findMany({
    where: { customerId: payload.customerId },
    orderBy: { createdAt: "desc" },
  });

  // Fetch product data for each wishlist item
  const productIds = wishlistItems.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      currency: true,
      images: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const currency = store.currency || "USD";

  function formatMoney(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/store/${slug}/account`} className="text-sm opacity-50 hover:opacity-80">← Account</Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--store-font-heading), sans-serif" }}>
          Wishlist
        </h1>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="rounded-lg border p-10 text-center" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
          <p className="opacity-50 mb-3">Your wishlist is empty</p>
          <Link href={`/stores/${slug}/products`} className="text-sm font-medium hover:underline" style={{ color: "var(--store-primary)" }}>
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlistItems.map((item) => {
            const product = productMap.get(item.productId);
            if (!product) return null;
            let imageUrl = "";
            try {
              const imgs = JSON.parse(product.images || "[]");
              imageUrl = imgs[0]?.url || "";
            } catch { /* empty */ }
            return (
              <div key={item.id} className="rounded-xl border overflow-hidden group" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
                <Link href={`/stores/${slug}/products/${product.slug}`}>
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-20">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--store-primary)" }}>
                    {formatMoney(product.priceCents)}
                  </p>
                  <form action={`/api/store/${slug}/account/wishlist`} method="POST" className="mt-2 flex gap-2">
                    <Link
                      href={`/store/${slug}/checkout?add=${product.id}`}
                      className="flex-1 text-center text-xs py-1.5 rounded-lg text-white font-medium"
                      style={{ backgroundColor: "var(--store-primary)" }}
                    >
                      Add to Cart
                    </Link>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
