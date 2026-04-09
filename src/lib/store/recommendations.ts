import { prisma } from "@/lib/db/client";

interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  viewCount: number;
  orderCount: number;
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  priceCents: true,
  currency: true,
  images: true,
  viewCount: true,
  orderCount: true,
} as const;

function extractImageUrl(imagesJson: string): string | undefined {
  try {
    return (JSON.parse(imagesJson) as { url: string }[])[0]?.url;
  } catch {
    return undefined;
  }
}

function mapToRecommendedProduct(
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    currency: string;
    images: string;
    viewCount: number;
    orderCount: number;
  }
): RecommendedProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    currency: product.currency,
    imageUrl: extractImageUrl(product.images),
    viewCount: product.viewCount,
    orderCount: product.orderCount,
  };
}

export async function getTrendingProducts(
  storeId: string,
  limit = 8
): Promise<RecommendedProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      deletedAt: null,
    },
    orderBy: [{ orderCount: "desc" }, { viewCount: "desc" }],
    take: limit,
    select: PRODUCT_SELECT,
  });

  return products.map(mapToRecommendedProduct);
}

export async function getSimilarProducts(
  productId: string,
  limit = 4
): Promise<RecommendedProduct[]> {
  const sourceProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { storeId: true, categoryId: true, priceCents: true },
  });

  if (!sourceProduct) {
    return [];
  }

  const { storeId, categoryId, priceCents } = sourceProduct;

  if (categoryId) {
    const products = await prisma.product.findMany({
      where: {
        categoryId,
        status: "ACTIVE",
        deletedAt: null,
        id: { not: productId },
        priceCents: {
          gte: Math.floor(priceCents * 0.5),
          lte: Math.ceil(priceCents * 1.5),
        },
      },
      orderBy: { orderCount: "desc" },
      take: limit,
      select: PRODUCT_SELECT,
    });

    return products.map(mapToRecommendedProduct);
  }

  // Fallback: same store products sorted by popularity
  const products = await prisma.product.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      deletedAt: null,
      id: { not: productId },
    },
    orderBy: [{ orderCount: "desc" }, { viewCount: "desc" }],
    take: limit,
    select: PRODUCT_SELECT,
  });

  return products.map(mapToRecommendedProduct);
}

export async function getFrequentlyBoughtTogether(
  productId: string,
  limit = 4
): Promise<RecommendedProduct[]> {
  const sourceProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { storeId: true },
  });

  if (!sourceProduct) {
    return [];
  }

  const orders = await prisma.order.findMany({
    where: {
      storeId: sourceProduct.storeId,
      items: { contains: productId },
    },
    select: { items: true },
  });

  const coOccurrenceCounts = new Map<string, number>();

  for (const order of orders) {
    try {
      const items = JSON.parse(order.items as string) as {
        productId: string;
      }[];
      for (const item of items) {
        if (item.productId !== productId) {
          coOccurrenceCounts.set(
            item.productId,
            (coOccurrenceCounts.get(item.productId) ?? 0) + 1
          );
        }
      }
    } catch {
      continue;
    }
  }

  const topIds = [...coOccurrenceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: topIds },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: PRODUCT_SELECT,
  });

  // Preserve frequency order
  const productMap = new Map(products.map((p) => [p.id, p]));
  return topIds
    .map((id) => productMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map(mapToRecommendedProduct);
}

export async function getProductRecommendations(
  productId: string,
  storeId: string
): Promise<{
  similar: RecommendedProduct[];
  boughtTogether: RecommendedProduct[];
  trending: RecommendedProduct[];
}> {
  const [similar, boughtTogether, trending] = await Promise.all([
    getSimilarProducts(productId),
    getFrequentlyBoughtTogether(productId),
    getTrendingProducts(storeId),
  ]);

  return { similar, boughtTogether, trending };
}
