"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { storeInfo, storeUrl } from "@/lib/data";

export default function AboutSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-primary-600 dark:text-primary-400 font-medium text-sm uppercase tracking-wide mb-3">
              Our Story
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              {storeInfo.mission}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {storeInfo.about}
            </p>
            <a
              href={storeUrl("/about")}
              className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium hover:gap-3 transition-all"
            >
              Learn more about us
              <ArrowRight size={16} />
            </a>
          </motion.div>

          {/* Image placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-800">
              <img
                src={storeInfo.bannerUrl}
                alt={`About ${storeInfo.name}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary-100 dark:bg-primary-900/30 rounded-2xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
