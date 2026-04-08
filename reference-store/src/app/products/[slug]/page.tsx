// SERVER component — exports generateStaticParams() for static export.
// Renders the client component which handles all interactive state.
// PATTERN: Dynamic [slug] routes with "output: export" MUST split like this.

import { products } from "@/lib/products";
import ProductDetailClient from "./ProductDetailClient";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  return <ProductDetailClient params={params} />;
}
