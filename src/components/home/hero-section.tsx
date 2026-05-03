"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

function FloatingTransparentImage({
  src,
  alt,
  className,
  sizes,
  delay = 0.25,
}: {
  src: string;
  alt: string;
  className: string;
  sizes: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay }}
      className={className}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized
        className="object-contain drop-shadow-[0_28px_55px_rgba(0,0,0,0.48)]"
        priority={delay < 0.35}
      />
    </motion.div>
  );
}

function HeroHumanVisual() {
  return (
    <div className="relative mx-auto h-[320px] w-full max-w-[560px] sm:h-[380px] lg:h-[460px] lg:max-w-none">
      <FloatingTransparentImage
        src={illustrationImages.humanCreator}
        alt="A human creator using FlowSmartly for commerce and marketing"
        className="absolute inset-0 z-10"
        sizes="(min-width: 1024px) 560px, 92vw"
      />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-background px-4 pb-8 pt-24 text-foreground sm:px-6 lg:px-8 dark:bg-[#020807] dark:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(14,165,233,0.16),rgba(255,255,255,0)_38%),linear-gradient(180deg,rgba(240,249,255,0.72),rgba(255,255,255,0)_58%)] dark:bg-[radial-gradient(circle_at_82%_24%,rgba(56,189,248,0.12),rgba(2,8,7,0)_40%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-6 lg:min-h-[520px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/15 dark:bg-white/10">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-emerald-300" />
            AI-powered growth workspace
          </div>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            AI marketing, commerce, and local growth together
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-muted-foreground dark:text-slate-300 lg:mx-0">
            FlowSmartly helps teams create content, sell products, manage local
            listings, and work with expert agents from one clean workspace.
          </p>
          <div className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center lg:mx-0">
            <div className="flex min-h-14 flex-1 items-center rounded-lg border border-input bg-card px-4 text-left text-sm text-muted-foreground shadow-lg dark:border-white/15 dark:bg-white dark:text-slate-500">
              <MessageSquare className="mr-3 h-5 w-5 text-muted-foreground dark:text-slate-400" />
              Enter your email
            </div>
            <Button size="lg" className="min-h-14 px-8 text-base font-bold" asChild>
              <Link href="/register">
                Try free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        <HeroHumanVisual />
      </div>
    </section>
  );
}
