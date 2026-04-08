"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { faq } from "@/lib/data";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Everything you need to know
        </p>
      </div>

      <div className="space-y-3">
        {faq.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-white pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
