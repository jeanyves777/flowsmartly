import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { resolveTheme } from "@/lib/store/theme-utils";
import { ProductCard, type ProductCardData } from "@/components/store/product-card";

interface ProductsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ params }: ProductsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!store) return { title: "Store Not Found" };

  return {
    title: `Products - ${store.name}`,
    description: `Browse products at ${store.name}`,
  };
}

const ITEMS_PER_PAGE = 12;

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low" },
  { value: "price_desc", label: "Price: High" },
  { value: "best_selling", label: "Best Selling" },
  { value: "trending", label: "Trending" },
];

export default async function ProductsPage({ params, searchParams }: ProductsPageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      theme: true,
      currency: true,
    },
  });

  if (!store) {
    notFound();
  }

  const theme = resolveTheme(store.theme);

  const page = Math.max(1, parseInt(sp.page || "1"));
  const categoryFilter = sp.category || undefined;
  const searchTerm = sp.search || undefined;
  const sort = sp.sort || "newest";

  // Build where clause
  const where: Record<string, unknown> = {
    storeId: store.id,
    status: "ACTIVE",
    deletedAt: null,
  };

  if (categoryFilter) {
    where.categoryId = categoryFilter;
  }

  if (searchTerm) {
    where.OR = [
      { name: { contains: searchTerm } },
      { description: { contains: searchTerm } },
    ];
  }

  // Sort
  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { priceCents: "asc" };
  else if (sort === "price_desc") orderBy = { priceCents: "desc" };
  else if (sort === "best_selling") orderBy = { orderCount: "desc" };
  else if (sort === "trending") orderBy = { viewCount: "desc" };

  // Fetch products and categories in parallel
  const [products, totalCount, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        comparePriceCents: true,
        currency: true,
        images: true,
        shortDescription: true,
        createdAt: true,
        orderCount: true,
        trackInventory: true,
        quantity: true,
        lowStockThreshold: true,
      },
    }),
    prisma.product.count({ where }),
    prisma.productCategory.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const selectedCategory = categoryFilter
    ? categories.find(c => c.id === categoryFilter)
    : undefined;

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const current = { category: categoryFilter, search: searchTerm, sort, page: String(page) };
    const merged = { ...current, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "undefined") p.set(k, v);
    }
    return `/store/${store!.slug}/products?${p.toString()}`;
  }

  // Spacing classes based on theme
  const spacingGap = theme.layout.spacing === "compact" ? "gap-4" : theme.layout.spacing === "spacious" ? "gap-8" : "gap-6";
  const spacingPy = theme.layout.spacing === "compact" ? "py-6" : theme.layout.spacing === "spacious" ? "py-12" : "py-8";

  // Product grid columns based on theme (responsive with xl breakpoint)
  const gridCols =
    theme.layout.productGrid === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : theme.layout.productGrid === "3"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${spacingPy}`}>
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href={`/store/${store.slug}`} className="opacity-60 hover:opacity-100 transition-opacity">
          Home
        </Link>
        <span className="opacity-30">/</span>
        {categoryFilter && selectedCategory ? (
          <>
            <Link href={`/store/${store.slug}/products`} className="opacity-60 hover:opacity-100 transition-opacity">
              Products
            </Link>
            <span className="opacity-30">/</span>
            <span className="font-medium">{selectedCategory.name}</span>
          </>
        ) : (
          <span className="font-medium">Products</span>
        )}
      </nav>

      <h1
        className="text-2xl font-bold mb-6"
        style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
      >
        Products
      </h1>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <form method="GET" action={`/store/${store.slug}/products`} className="flex-1">
          <input
            type="text"
            name="search"
            defaultValue={searchTerm}
            placeholder="Search products..."
            className="w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={
              {
                backgroundColor: 'var(--store-background)',
                borderColor: `color-mix(in srgb, var(--store-text) 12%, transparent)`,
                "--tw-ring-color": 'var(--store-primary)',
              } as React.CSSProperties
            }
          />
          {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
          {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
        </form>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:whitespace-normal sm:pb-0">
            <Link
              href={buildUrl({ category: undefined, page: "1" })}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !categoryFilter
                  ? "text-white"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={
                !categoryFilter
                  ? { backgroundColor: 'var(--store-primary)' }
                  : { backgroundColor: `color-mix(in srgb, var(--store-text) 6%, transparent)` }
              }
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={buildUrl({ category: cat.id, page: "1" })}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat.id
                    ? "text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={
                  categoryFilter === cat.id
                    ? { backgroundColor: 'var(--store-primary)' }
                    : { backgroundColor: `color-mix(in srgb, var(--store-text) 6%, transparent)` }
                }
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-50 whitespace-nowrap">Sort by:</label>
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ sort: opt.value, page: "1" })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sort === opt.value ? "text-white" : "opacity-60 hover:opacity-100"
                }`}
                style={
                  sort === opt.value
                    ? { backgroundColor: 'var(--store-text)' }
                    : { backgroundColor: `color-mix(in srgb, var(--store-text) 6%, transparent)` }
                }
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="opacity-60">
            {searchTerm ? `No products found for "${searchTerm}".` : "No products available."}
          </p>
        </div>
      ) : (
        <div className={`grid ${gridCols} ${spacingGap}`}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product as ProductCardData}
              storeSlug={store.slug}
              cardStyle={theme.layout.cardStyle}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Previous
            </Link>
          )}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} className="flex items-center gap-1">
                    {showEllipsis && <span className="px-1 opacity-40">...</span>}
                    <Link
                      href={buildUrl({ page: String(p) })}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium ${
                        p === page ? "text-white" : "hover:opacity-80"
                      }`}
                      style={p === page ? { backgroundColor: 'var(--store-primary)' } : undefined}
                    >
                      {p}
                    </Link>
                  </span>
                );
              })}
          </div>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
