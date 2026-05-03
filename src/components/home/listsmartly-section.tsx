"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, MessageSquare, Star } from "lucide-react";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

const listingChecks = [
  "Google Business",
  "Apple Maps",
  "Yelp",
  "Local directories",
];

export function ListSmartlySection() {
  return (
    <section className="relative overflow-hidden bg-muted/35 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-teal-50/80 to-transparent dark:from-teal-950/20" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="relative min-h-[500px] overflow-visible"
          >
            <div className="absolute right-5 top-5 z-10 rounded-lg border bg-card/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Review health
              </div>
              <div className="mt-2 text-3xl font-black">4.8</div>
              <div className="mt-1 text-xs text-muted-foreground">AI responses drafted</div>
            </div>
            <Image
              src={illustrationImages.homeLocalOwner}
              alt="A local business owner using ListSmartly to manage listings"
              fill
              sizes="(min-width: 1024px) 620px, 92vw"
              unoptimized
              className="object-contain object-bottom drop-shadow-[0_28px_55px_rgba(0,0,0,0.22)]"
            />
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
            <h2 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Keep every local profile accurate and review-ready
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Sync your business information across directories, monitor review
              health, and let AI help with consistent, brand-safe responses.
            </p>

            <div className="mt-8 rounded-lg border bg-card p-5">
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
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3 font-semibold text-white shadow-lg shadow-teal-500/20 transition-opacity hover:opacity-90"
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
