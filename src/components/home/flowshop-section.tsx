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
    <section className="relative overflow-hidden bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-violet-50/70 to-transparent dark:from-violet-950/20" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
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
            <h2 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Launch a store that looks ready for real customers
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Build an AI-powered storefront, create product copy, accept
              payments, and manage orders without stitching together another
              stack of tools.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 transition-opacity hover:opacity-90"
            >
              Explore FlowShop
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative min-h-[470px] overflow-visible"
          >
            <div className="absolute left-5 top-5 z-10 rounded-lg border bg-card/90 p-4 shadow-sm">
              <div className="text-sm font-semibold">Today&apos;s orders</div>
              <div className="mt-2 text-3xl font-black">128</div>
              <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">+22% from last week</div>
            </div>
            <Image
              src={illustrationImages.homeFlowShopSeller}
              alt="A store owner preparing an online order with FlowShop"
              fill
              sizes="(min-width: 1024px) 640px, 92vw"
              unoptimized
              className="object-contain object-bottom drop-shadow-[0_28px_55px_rgba(0,0,0,0.24)]"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
