"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ProductGrid from "@/components/ProductGrid";
import { categories } from "@/lib/data";

export default function CategoryClient({ params }: { params: { slug: string } }) {
  const category = categories.find((c) => c.slug === params.slug);

  if (!category) {
    return (
      <main className="px-4 py-16 text-center">
        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Category not found</h1>
        <Link href="/products" className="text-sm font-medium text-primary hover:underline">
          Browse all products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/products"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-primary dark:text-gray-400"
      >
        <ChevronLeft size={14} />
        All products
      </Link>
      <div className="mb-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Category
        </p>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="max-w-2xl text-gray-500 dark:text-gray-400">{category.description}</p>
        )}
      </div>
      <ProductGrid initialCategory={category.id} />
    </main>
  );
}
