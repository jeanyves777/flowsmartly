"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { storeInfo, storeUrl } from "@/lib/data";

interface PolicyPageProps {
  title: string;
  icon?: React.ReactNode;
  content: string;
  lastUpdated?: string;
}

export default function PolicyPage({ title, icon, content, lastUpdated }: PolicyPageProps) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 mb-6">
            <Link href={storeUrl("/")} className="hover:text-primary-600 transition-colors">Home</Link>
            <ChevronRight size={14} />
            <span className="text-gray-700 dark:text-gray-200 font-medium">{title}</span>
          </nav>

          {/* Branded header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              {icon && (
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                  {icon}
                </div>
              )}
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h1>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Last updated: {lastUpdated || "January 2026"}
                </p>
              </div>
            </div>
            {/* Accent bar */}
            <div className="h-1 w-20 rounded-full bg-primary-500 mt-4" />
          </div>

          {/* Policy content */}
          <article>
            <div
              className="prose prose-lg dark:prose-invert max-w-none
                prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-headings:font-semibold prose-headings:mt-10 prose-headings:mb-4
                prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed
                prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
                prose-li:text-gray-600 dark:prose-li:text-gray-300
                prose-strong:text-gray-900 dark:prose-strong:text-white"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </article>

          {/* Back to shop */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <Link
              href={storeUrl("/")}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Shop
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} storeSlug="example-store" />
    </>
  );
}
