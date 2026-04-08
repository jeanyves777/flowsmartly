// SERVER component — exports generateStaticParams() for static export.
// PATTERN: Dynamic [slug] routes with "output: export" MUST split like this.

import { categories } from "@/lib/data";
import CategoryClient from "./CategoryClient";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  return <CategoryClient params={params} />;
}
