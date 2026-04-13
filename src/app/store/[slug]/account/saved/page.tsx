import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyCustomerToken } from "@/lib/store/customer-auth";
import { prisma } from "@/lib/db/client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SavedForLaterPage({ params }: PageProps) {
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

  const savedItems = await prisma.storeCartItem.findMany({
    where: { customerId: payload.customerId, savedForLater: true },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch product data
  const productIds = savedItems.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, priceCents: true, currency: true, images: true },
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
          Saved for Later
        </h1>
      </div>

      {savedItems.length === 0 ? (
        <div className="rounded-lg border p-10 text-center" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
          <p className="opacity-50 mb-3">No saved items</p>
          <Link href={`/stores/${slug}/products`} className="text-sm font-medium hover:underline" style={{ color: "var(--store-primary)" }}>
            Browse products
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {savedItems.map((item) => {
            const product = productMap.get(item.productId);
            if (!product) return null;
            let imageUrl = "";
            try {
              const imgs = JSON.parse(product.images || "[]");
              imageUrl = imgs[0]?.url || "";
            } catch { /* empty */ }
            return (
              <div key={item.id} className="flex items-center gap-4 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
                <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {imageUrl && <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{product.name}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--store-primary)" }}>
                    {formatMoney(product.priceCents)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <form action={`/api/store/${slug}/account/cart/save-for-later`} method="DELETE">
                    <input type="hidden" name="productId" value={item.productId} />
                    <input type="hidden" name="variantId" value={item.variantId || ""} />
                    <button type="submit" className="text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ backgroundColor: "var(--store-primary)" }}>
                      Move to Cart
                    </button>
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
