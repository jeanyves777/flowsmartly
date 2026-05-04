"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CreditCard,
  Palette,
  ShoppingBag,
} from "lucide-react";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

const features = [
  { icon: Palette, label: "10 pro themes", value: "Launch polished" },
  { icon: Brain, label: "AI product copy", value: "Write faster" },
  { icon: CreditCard, label: "Secure checkout", value: "Sell safely" },
  { icon: BarChart3, label: "Store analytics", value: "Track growth" },
];

export function FlowShopSection() {
  return (
    <section className="relative overflow-hidden bg-background px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-12 lg:px-8 lg:pb-0 lg:pt-12">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-50/70 to-transparent dark:from-violet-950/20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <ShoppingBag className="h-4 w-4" />
              FlowShop
            </span>
            <h2 className="text-balance text-2xl font-black sm:text-3xl lg:text-4xl">
              Launch a store that looks ready for real customers
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Build an AI-powered storefront, create product copy, accept
              payments, and manage orders without stitching together another
              stack of tools.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.label} className="rounded-lg border bg-card p-4">
                  <feature.icon className="mb-3 h-5 w-5 text-violet-600 dark:text-violet-300" />
                  <div className="font-semibold">{feature.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{feature.value}</div>
                </div>
              ))}
            </div>

            <Link
              href="/flowshop"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 transition-opacity hover:opacity-90"
            >
              Explore FlowShop
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="lg:self-end"
          >
            <div className="relative mx-auto h-[340px] w-full max-w-[620px] overflow-visible sm:h-[460px] lg:h-[560px] lg:max-w-[680px]">
              <Link
                href="/flowshop"
                className="absolute left-2 right-2 top-0 z-20 inline-flex items-center justify-between gap-4 rounded-lg border bg-white/90 px-4 py-3 text-sm font-bold text-zinc-950 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 sm:left-auto sm:right-4 sm:min-w-[320px]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-black uppercase tracking-wide text-violet-600 dark:text-violet-300">
                      Store preview
                    </span>
                    <span className="block">Build checkout-ready shop</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
              </Link>
              <Image
                src={illustrationImages.flowShopCommerceCutout}
                alt="Ecommerce storefront, checkout, product, shipping, and analytics assets for FlowShop"
                fill
                sizes="(min-width: 1024px) 680px, 92vw"
                unoptimized
                className="object-contain object-bottom drop-shadow-[0_30px_60px_rgba(76,29,149,0.16)] dark:drop-shadow-[0_30px_60px_rgba(0,0,0,0.42)]"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
