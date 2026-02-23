import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { resolveTheme } from "@/lib/store/theme-utils";

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
  const primaryColor = theme.colors.primary;

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

  // Card style classes
  function getCardClasses(): string {
    switch (theme.layout.cardStyle) {
      case "rounded":
        return "rounded-xl p-2 bg-white/50";
      case "sharp":
        return "rounded-none";
      case "shadow":
        return "rounded-lg shadow-md hover:shadow-lg transition-shadow";
      case "bordered":
        return "rounded-lg border";
      case "minimal":
      default:
        return "";
    }
  }

  function getImageClasses(): string {
    switch (theme.layout.cardStyle) {
      case "rounded":
        return "rounded-xl";
      case "sharp":
        return "rounded-none";
      case "shadow":
        return "rounded-lg";
      case "bordered":
        return "rounded-lg";
      case "minimal":
      default:
        return "rounded-xl";
    }
  }

  const cardClasses = getCardClasses();
  const imageClasses = getImageClasses();

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${spacingPy}`}>
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
                backgroundColor: theme.colors.background,
                borderColor: `${theme.colors.text}20`,
                "--tw-ring-color": primaryColor,
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
                  ? { backgroundColor: primaryColor }
                  : { backgroundColor: `${theme.colors.text}10` }
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
                    ? { backgroundColor: primaryColor }
                    : { backgroundColor: `${theme.colors.text}10` }
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
            {[
              { value: "newest", label: "Newest" },
              { value: "price_asc", label: "Price: Low" },
              { value: "price_desc", label: "Price: High" },
            ].map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ sort: opt.value, page: "1" })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sort === opt.value ? "text-white" : "opacity-60 hover:opacity-100"
                }`}
                style={
                  sort === opt.value
                    ? { backgroundColor: theme.colors.text }
                    : { backgroundColor: `${theme.colors.text}10` }
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
          {products.map((product) => {
            const images = JSON.parse(product.images || "[]") as { url: string; alt?: string }[];
            const mainImage = images[0];
            return (
              <Link
                key={product.id}
                href={`/store/${store.slug}/products/${product.slug}`}
                className={`group ${cardClasses}`}
              >
                <div className={`aspect-square overflow-hidden bg-gray-100 mb-3 ${imageClasses}`}>
                  {mainImage ? (
                    <Image
                      src={mainImage.url}
                      alt={mainImage.alt || product.name}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-medium group-hover:underline line-clamp-2">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                    {formatPrice(product.priceCents, product.currency)}
                  </p>
                  {product.comparePriceCents && product.comparePriceCents > product.priceCents && (
                    <p className="text-xs line-through opacity-40">
                      {formatPrice(product.comparePriceCents, product.currency)}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
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
                      style={p === page ? { backgroundColor: primaryColor } : undefined}
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
