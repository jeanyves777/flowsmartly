import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import type { ProductInput } from "./store-agent";

export interface PersistedProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  comparePriceCents: number | null;
  category: string | null;
  categoryId: string | null;
  images: string[];
}
export interface PersistedCategory { id: string; name: string; slug: string }

/**
 * Persist a store's INITIAL catalog to the DB (ProductCategory + Product) with
 * real cuids + slugs, status ACTIVE. Products are DB-first and user-controlled —
 * never hardcoded fakes in the storefront. The generator reads these back so the
 * storefront carries real ids (so detail pages + checkout resolve against the DB).
 *
 * Idempotent-ish: skips categories/products whose slug already exists for the
 * store, so a re-generation won't duplicate the catalog.
 */
export async function persistStoreCatalog(
  storeId: string,
  products: ProductInput[],
  categoryNames: string[],
  currency = "USD",
): Promise<{ products: PersistedProduct[]; categories: PersistedCategory[] }> {
  const existingCats = await prisma.productCategory.findMany({ where: { storeId }, select: { name: true, slug: true, id: true } });
  const catByName = new Map<string, PersistedCategory>(existingCats.map((c) => [c.name, { id: c.id, name: c.name, slug: c.slug }]));
  const usedCatSlugs = new Set(existingCats.map((c) => c.slug));

  const wantedCats = [...new Set([...categoryNames, ...products.map((p) => p.category).filter((c): c is string => !!c)])];
  let sort = existingCats.length;
  for (const name of wantedCats) {
    if (catByName.has(name)) continue;
    let slug = generateSlug(name) || "category";
    let n = 1;
    while (usedCatSlugs.has(slug)) slug = `${generateSlug(name) || "category"}-${++n}`;
    usedCatSlugs.add(slug);
    const cat = await prisma.productCategory.create({ data: { storeId, name, slug, sortOrder: sort++ } });
    catByName.set(name, { id: cat.id, name, slug });
  }

  const existingProds = await prisma.product.findMany({ where: { storeId }, select: { slug: true } });
  const usedProdSlugs = new Set(existingProds.map((p) => p.slug));
  const created: PersistedProduct[] = [];
  for (const p of products) {
    if (!p.name || !(p.priceCents > 0)) continue;
    let slug = generateSlug(p.name) || "product";
    let n = 1;
    while (usedProdSlugs.has(slug)) slug = `${generateSlug(p.name) || "product"}-${++n}`;
    usedProdSlugs.add(slug);
    const cat = p.category ? catByName.get(p.category) : undefined;
    const images = (p.images || []).filter(Boolean).map((url) => ({ url, alt: p.name }));
    const prod = await prisma.product.create({
      data: {
        storeId, name: p.name, slug,
        description: p.description || null,
        priceCents: p.priceCents,
        comparePriceCents: p.comparePriceCents ?? null,
        category: p.category || null,
        categoryId: cat?.id ?? null,
        currency,
        tags: JSON.stringify(p.tags || []),
        labels: JSON.stringify(p.labels || []),
        images: JSON.stringify(images),
        status: "ACTIVE",
      },
    });
    created.push({
      id: prod.id, slug, name: p.name, description: p.description || "",
      priceCents: p.priceCents, comparePriceCents: p.comparePriceCents ?? null,
      category: p.category || null, categoryId: cat?.id ?? null,
      images: images.map((i) => i.url),
    });
  }

  return { products: created, categories: [...catByName.values()] };
}
