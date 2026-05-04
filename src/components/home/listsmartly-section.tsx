"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, MessageSquare } from "lucide-react";
import { LocalListingsVisual } from "@/components/home/home-ui-previews";

const listingChecks = [
  "Google Business",
  "Apple Maps",
  "Yelp",
  "Local directories",
];

export function ListSmartlySection() {
  return (
    <section className="relative overflow-hidden bg-muted/35 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-teal-50/80 to-transparent dark:from-teal-950/20" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div className="relative">
              <Link
                href="/listsmartly-details"
                className="absolute left-2 right-2 top-0 z-20 inline-flex items-center justify-between gap-4 rounded-lg border bg-white/90 px-4 py-3 text-sm font-bold text-zinc-950 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 sm:left-4 sm:right-auto sm:min-w-[330px]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-black uppercase tracking-wide text-teal-600 dark:text-teal-300">
                      Local visibility
                    </span>
                    <span className="block">Check listings and reviews</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" />
              </Link>
              <LocalListingsVisual />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
              <MapPin className="h-4 w-4" />
              ListSmartly
            </span>
            <h2 className="text-balance text-2xl font-black sm:text-3xl lg:text-4xl">
              Keep every local profile accurate and review-ready
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Sync your business information across directories, monitor review
              health, and let AI help with consistent, brand-safe responses.
            </p>

            <div className="mt-6 rounded-lg border bg-card p-5">
              <div className="mb-4 flex items-center gap-2 font-semibold">
                <MessageSquare className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                Listing sync queue
              </div>
              <div className="grid gap-3">
                {listingChecks.map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                    <span className="text-sm font-medium">{item}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/listsmartly-details"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3 font-semibold text-white shadow-lg shadow-teal-500/20 transition-opacity hover:opacity-90"
            >
              Explore ListSmartly
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
