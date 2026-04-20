"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categories } from "@/lib/data";

const MotionLink = motion(Link);

export default function CategoryShowcase() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Shop by Category
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Browse our curated collections
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat, i) => (
          <MotionLink
            key={cat.id}
            href={`/category/${cat.slug}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative h-72 rounded-2xl overflow-hidden block"
          >
            {/* Background image */}
            {cat.image && (
              <img
                src={cat.image}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/30 to-transparent" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h3 className="text-xl font-bold text-white mb-1">{cat.name}</h3>
              <p className="text-sm text-gray-300 mb-3">{cat.description}</p>
              <div className="flex items-center gap-2 text-primary-300 text-sm font-medium group-hover:text-primary-200 transition-colors">
                <span>{cat.productCount} products</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </MotionLink>
        ))}
      </div>
    </section>
  );
}
