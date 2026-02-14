"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Sparkles, Zap, Building2 } from "lucide-react";
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

const planGradients: Record<string, string> = {
  STARTER: "from-gray-500 to-gray-600",
  PRO: "from-brand-500 to-accent-purple",
  BUSINESS: "from-blue-500 to-indigo-600",
};

export function PricingPreview() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments/packages")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.plans) {
          setPlans(data.data.plans.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card p-6 animate-pulse"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted mb-4" />
                  <div className="h-5 w-24 bg-muted rounded mb-2" />
                  <div className="h-8 w-20 bg-muted rounded mb-6" />
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-4 bg-muted rounded w-full" />
                    ))}
                  </div>
                </div>
              ))
            : plans.map((plan, index) => {
                const Icon = planIcons[plan.slug] || Sparkles;
                const gradient = planGradients[plan.slug] || "from-gray-500 to-gray-600";

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`relative rounded-xl border bg-card p-6 ${
                      plan.isPopular ? "ring-2 ring-brand-500 shadow-lg shadow-brand-500/10" : ""
                    }`}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-500 text-white text-xs font-medium">
                        Popular
                      </div>
                    )}
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-4`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-bold">
                        {plan.priceCentsMonthly === 0
                          ? "Free"
                          : `$${(plan.priceCentsMonthly / 100).toFixed(0)}`}
                      </span>
                      {plan.priceCentsMonthly > 0 && (
                        <span className="text-sm text-muted-foreground">/mo</span>
                      )}
                    </div>
                    <ul className="space-y-2 mb-6">
                      {(plan.features as string[]).slice(0, 5).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      variant={plan.isPopular ? "default" : "outline"}
                      className="w-full"
                    >
                      <Link href="/register">
                        {plan.priceCentsMonthly === 0 ? "Start Free" : "Get Started"}
                      </Link>
                    </Button>
                  </motion.div>
                );
              })}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/pricing"
            className="text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
          >
            View all plans and features →
          </Link>
        </div>
      </div>
    </section>
  );
}
