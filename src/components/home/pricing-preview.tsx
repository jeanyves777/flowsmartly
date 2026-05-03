"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCentsMonthly: number;
  monthlyCredits: number;
  features: string[];
  isPopular: boolean;
}

const planIcons: Record<string, React.ElementType> = {
  STARTER: Sparkles,
  PRO: Zap,
  BUSINESS: Building2,
};

const planAccents: Record<string, string> = {
  STARTER: "bg-sky-500",
  PRO: "bg-brand-500",
  BUSINESS: "bg-violet-500",
};

const included = [
  "AI content workspace",
  "Campaign publishing flow",
  "Email and SMS-ready tools",
  "Reporting dashboard",
];

export function PricingPreview() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments/packages")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.data?.plans) {
          setPlans(data.data.plans.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="bg-muted/35 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              Pricing
            </p>
            <h2 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Start lean, then scale the whole growth workspace
            </h2>
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Free plan available</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade only when volume, channels, or team workflow needs more room.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {included.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-brand-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="min-h-[430px] rounded-lg border bg-card p-6 shadow-sm">
                  <div className="mb-6 h-12 w-12 animate-pulse rounded-lg bg-muted" />
                  <div className="mb-3 h-5 w-28 animate-pulse rounded bg-muted" />
                  <div className="mb-8 h-10 w-24 animate-pulse rounded bg-muted" />
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((__, itemIndex) => (
                      <div key={itemIndex} className="h-4 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                </div>
              ))
            : plans.map((plan) => {
                const Icon = planIcons[plan.slug] || Sparkles;
                const accent = planAccents[plan.slug] || "bg-brand-500";

                return (
                  <article
                    key={plan.id}
                    className={`relative flex min-h-[430px] flex-col rounded-lg border bg-card p-6 shadow-sm ${
                      plan.isPopular ? "border-brand-500 shadow-brand-500/10" : ""
                    }`}
                  >
                    {plan.isPopular && (
                      <div className="absolute right-5 top-5 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">
                        Popular
                      </div>
                    )}
                    <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${accent} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-4xl font-black tracking-tight">
                        {plan.priceCentsMonthly === 0
                          ? "Free"
                          : `$${(plan.priceCentsMonthly / 100).toFixed(0)}`}
                      </span>
                      {plan.priceCentsMonthly > 0 && (
                        <span className="pb-1 text-sm text-muted-foreground">/mo</span>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {plan.monthlyCredits.toLocaleString()} credits monthly
                    </p>

                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.slice(0, 5).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      variant={plan.isPopular ? "default" : "outline"}
                      className="mt-7 min-h-12 w-full font-bold"
                    >
                      <Link href="/register">
                        {plan.priceCentsMonthly === 0 ? "Start free" : "Get started"}
                      </Link>
                    </Button>
                  </article>
                );
              })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-300"
          >
            View all plans and features
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
