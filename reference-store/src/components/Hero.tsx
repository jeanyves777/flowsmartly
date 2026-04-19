"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { heroConfig, storeInfo, storeUrl, STORE_BASE } from "@/lib/data";

const AUTO_ADVANCE_MS = 5500;

/**
 * Normalize the hero CTA href so it stays on the store no matter how the
 * store's data.ts was generated. Agent-produced data often sets ctaUrl to
 * "/products" (bare relative path). On the main flowsmartly.com host that
 * path would point at the main app's /products, dropping the user out of
 * the store. Here we force any relative path through storeUrl() unless
 * it's already a full URL or already prefixed with the store's base path.
 */
function resolveCtaHref(raw: string | undefined): string {
  if (!raw) return storeUrl("/products");
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith(STORE_BASE)) return raw;
  if (raw.startsWith("/")) return storeUrl(raw);
  return raw;
}

export default function Hero() {
  // Collect slide images: prefer `slides` array, fall back to single backgroundImage
  const slides: string[] = (() => {
    const s = (heroConfig as { slides?: string[] }).slides;
    if (Array.isArray(s) && s.length > 0) return s.filter(Boolean);
    if (heroConfig.backgroundImage) return [heroConfig.backgroundImage];
    return [];
  })();

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSlideshow = slides.length > 1;

  useEffect(() => {
    if (!hasSlideshow || paused) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasSlideshow, paused, slides.length]);

  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx((i) => (i + 1) % slides.length);

  const isGradientOnly = slides.length === 0;

  return (
    <section
      className="relative min-h-[52vh] md:min-h-[60vh] flex items-center overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background layer */}
      {isGradientOnly ? (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600" />
      ) : (
        <AnimatePresence mode="sync">
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="absolute inset-0"
          >
            <img
              src={slides[idx]}
              alt={`${storeInfo.name} hero ${idx + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Overlay for text readability */}
      {!isGradientOnly && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-gray-900/75 via-gray-900/50 to-gray-900/20"
          style={{ opacity: heroConfig.overlayOpacity ?? 0.55 }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 w-full">
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-primary-200 font-medium tracking-wide uppercase text-xs md:text-sm mb-3"
          >
            {storeInfo.tagline}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-4"
          >
            {heroConfig.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-lg text-gray-100 mb-6 leading-relaxed"
          >
            {heroConfig.subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <a
              href={resolveCtaHref(heroConfig.ctaUrl)}
              className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-full transition-all hover:shadow-lg hover:shadow-primary-600/30 group/cta"
            >
              {heroConfig.ctaText}
              <ArrowRight size={18} className="group-hover/cta:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </div>

      {/* Slideshow controls */}
      {hasSlideshow && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 p-2 md:p-2.5 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Previous slide"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 p-2 md:p-2.5 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Next slide"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-8 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
