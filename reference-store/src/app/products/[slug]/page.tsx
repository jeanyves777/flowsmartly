// SERVER component — renders the client component which handles all data fetch.
// In Next 15, params is a Promise and MUST be awaited before its properties
// can be accessed. Passing the raw Promise through means the client component
// gets `params.slug === undefined` and every product page shows "not found".
// force-dynamic because live product data is fetched at request time.

import ProductDetailClient from "./ProductDetailClient";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <ProductDetailClient params={resolvedParams} />;
}
