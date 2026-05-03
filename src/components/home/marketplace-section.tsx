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
  ShieldCheck,
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
    <section className="relative overflow-hidden bg-muted/35 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-violet-50/80 to-transparent dark:from-violet-950/20" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="relative min-h-[520px] overflow-visible"
          >
            <div className="absolute right-5 top-5 z-10 rounded-lg border bg-card/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Verified expert
              </div>
              <div className="mt-2 text-3xl font-black">92</div>
              <div className="mt-1 text-xs text-muted-foreground">performance score</div>
            </div>
            <Image
              src={illustrationImages.homeAgentConsultant}
              alt="A marketing consultant reviewing client campaign performance"
              fill
              sizes="(min-width: 1024px) 620px, 92vw"
              unoptimized
              className="object-contain object-bottom drop-shadow-[0_28px_55px_rgba(0,0,0,0.22)]"
            />
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
            <h2 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Hire expert agents without leaving the platform
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Bring in vetted marketers to run content, campaigns, reporting,
              and growth workflows inside the same system your team uses.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {agentStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card p-4">
                  <stat.icon className="mb-3 h-5 w-5 text-violet-600 dark:text-violet-300" />
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-lg border bg-card p-5">
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

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
