"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Check } from "lucide-react";
import { storeInfo } from "@/lib/data";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // In production, this would POST to an API endpoint
    setSubmitted(true);
    setEmail("");
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-6">
            <Mail size={24} className="text-primary-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Stay in the loop
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Subscribe for exclusive deals, new arrivals, and {storeInfo.name} news. No spam, ever.
          </p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full font-medium"
            >
              <Check size={18} />
              You are subscribed!
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 px-5 py-3.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-full transition-colors group"
              >
                Subscribe
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
