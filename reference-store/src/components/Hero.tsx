"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { heroConfig, storeInfo } from "@/lib/data";

export default function Hero() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Background */}
      {heroConfig.style === "image" || heroConfig.style === "gradient" ? (
        <>
          {heroConfig.backgroundImage && (
            <img
              src={heroConfig.backgroundImage}
              alt={`${storeInfo.name} hero`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-gray-900/60 to-transparent"
            style={{ opacity: heroConfig.overlayOpacity || 0.4 }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600" />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-primary-300 font-medium tracking-wide uppercase text-sm mb-4"
          >
            {storeInfo.tagline}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
          >
            {heroConfig.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg sm:text-xl text-gray-200 mb-8 leading-relaxed"
          >
            {heroConfig.subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a
              href={heroConfig.ctaUrl}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-full transition-all hover:shadow-lg hover:shadow-primary-600/25 group"
            >
              {heroConfig.ctaText}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </div>

      {/* Decorative gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-gray-950 to-transparent" />
    </section>
  );
}
