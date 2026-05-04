"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Search,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

const agentStats = [
  { icon: Star, label: "Avg. rating", value: "4.9" },
  { icon: Users, label: "Managed clients", value: "320+" },
  { icon: BarChart3, label: "Performance tracked", value: "AI" },
];

const steps = [
  "Browse verified agents",
  "Match by goals and budget",
  "Track work inside FlowSmartly",
];

export function MarketplaceSection() {
  return (
    <section className="relative overflow-hidden bg-muted/35 px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8 lg:pb-0 lg:pt-10">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-50/80 to-transparent dark:from-violet-950/20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-violet-400/55 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 z-0 h-24 w-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.18),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.10),transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="lg:self-end"
          >
            <div className="relative mx-auto h-[380px] w-full max-w-[520px] overflow-visible sm:h-[500px] lg:h-[700px] lg:max-w-[620px]">
              <Image
                src={illustrationImages.homeAgentConsultant}
                alt="A FlowSmartly agent consultant reviewing marketplace work"
                fill
                sizes="(min-width: 1024px) 620px, 92vw"
                unoptimized
                className="object-contain object-bottom drop-shadow-[0_30px_60px_rgba(76,29,149,0.18)] dark:drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <Briefcase className="h-4 w-4" />
              Agent Marketplace
            </span>
            <h2 className="text-balance text-2xl font-black sm:text-3xl lg:text-4xl">
              Hire expert agents without leaving the platform
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Bring in vetted marketers to run content, campaigns, reporting,
              and growth workflows inside the same system your team uses.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {agentStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card p-4">
                  <stat.icon className="mb-3 h-5 w-5 text-violet-600 dark:text-violet-300" />
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border bg-card p-5">
              <div className="mb-4 flex items-center gap-2 font-semibold">
                <Search className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                Hiring flow
              </div>
              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{step}</span>
                    <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/marketplace">
                  Explore marketplace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register">Become an agent</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
