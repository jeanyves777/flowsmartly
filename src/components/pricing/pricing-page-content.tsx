"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Check,
  X,
  Sparkles,
  Zap,
  Building2,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthlyCredits: number;
  priceCentsMonthly: number;
  priceCentsYearly: number;
  features: string[];
  isPopular: boolean;
  color: string | null;
  icon: string | null;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus: number;
  priceCents: number;
  priceFormatted: string;
  isPopular: boolean;
}

const planIcons: Record<string, React.ElementType> = {
  STARTER: Sparkles,
  PRO: Zap,
  BUSINESS: Building2,
  ENTERPRISE: Rocket,
};

const planGradients: Record<string, string> = {
  STARTER: "from-gray-500 to-gray-600",
  PRO: "from-brand-500 to-accent-purple",
  BUSINESS: "from-blue-500 to-indigo-600",
  ENTERPRISE: "from-orange-500 to-red-500",
};

const comparisonFeatures = [
  { name: "AI Content Generation", starter: true, pro: true, business: true, enterprise: true },
  { name: "Social Feed & Sharing", starter: true, pro: true, business: true, enterprise: true },
  { name: "Monthly Credits", starter: "100", pro: "5,000", business: "25,000", enterprise: "Unlimited" },
  { name: "Email Campaigns", starter: false, pro: true, business: true, enterprise: true },
  { name: "SMS Campaigns", starter: false, pro: false, business: true, enterprise: true },
  { name: "Team Members", starter: "1", pro: "3", business: "10", enterprise: "Unlimited" },
  { name: "Analytics Dashboard", starter: "Basic", pro: "Advanced", business: "Advanced", enterprise: "Custom" },
  { name: "API Access", starter: false, pro: false, business: true, enterprise: true },
  { name: "Priority Support", starter: false, pro: true, business: true, enterprise: true },
  { name: "Custom Branding", starter: false, pro: false, business: true, enterprise: true },
];

const faqs = [
  {
    question: "Can I change plans later?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be prorated for the remaining billing period. When downgrading, the new plan takes effect at the start of your next billing cycle.",
  },
  {
    question: "What happens to unused credits?",
    answer:
      "Unused credits roll over for up to 3 months on paid plans. After that, they expire. Purchased credit packages never expire.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a 14-day money-back guarantee on all paid plans. If you're not satisfied, contact our support team for a full refund.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your current billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express), as well as PayPal and Apple Pay through our secure Stripe payment processing.",
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-4 h-4 text-brand-500 mx-auto" />
    ) : (
      <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function PricingPageContent() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/payments/packages")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setPlans(data.data.plans || []);
          setCreditPackages(data.data.creditPackages || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero — Dark gradient variant */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="pr-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pr-grid)" />
          </svg>
        </div>
        {/* Floating orbs */}
        <div className="absolute top-20 left-[15%] w-32 h-32 bg-blue-500/20 rounded-full blur-3xl animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 right-[20%] w-40 h-40 bg-brand-500/20 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite_2s]" />
        <div className="absolute top-40 right-[10%] w-24 h-24 bg-emerald-500/20 rounded-full blur-3xl animate-[float_5s_ease-in-out_infinite_1s]" />

        <style jsx global>{`
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 text-blue-300 text-sm font-medium mb-6 border border-blue-500/30">
              <Sparkles className="w-4 h-4" />
              Transparent Pricing
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Simple Plans,{" "}
              <span className="bg-gradient-to-r from-blue-400 to-brand-400 bg-clip-text text-transparent">
                Powerful Results
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Choose the plan that fits your needs. Start free, upgrade anytime.
              Every plan includes AI content creation and marketing tools.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Billing toggle */}
        <motion.div
          className="flex justify-center mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-muted/50 border">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-medium">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-6 animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-muted mb-4" />
                  <div className="h-5 w-24 bg-muted rounded mb-2" />
                  <div className="h-8 w-20 bg-muted rounded mb-6" />
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="h-4 bg-muted rounded w-full" />
                    ))}
                  </div>
                </div>
              ))
            : plans.map((plan, index) => {
                const Icon = planIcons[plan.id] || Sparkles;
                const gradient = planGradients[plan.id] || "from-gray-500 to-gray-600";
                const price =
                  billingCycle === "monthly"
                    ? plan.priceCentsMonthly
                    : Math.round(plan.priceCentsYearly / 12);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`relative rounded-xl border bg-card p-6 flex flex-col ${
                      plan.isPopular
                        ? "ring-2 ring-brand-500 shadow-lg shadow-brand-500/10"
                        : ""
                    }`}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-500 text-white text-xs font-medium">
                        Most Popular
                      </div>
                    )}
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-4`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-baseline gap-1 mt-4 mb-6">
                      <span className="text-3xl font-bold">
                        {price === 0 ? "Free" : `$${(price / 100).toFixed(0)}`}
                      </span>
                      {price > 0 && (
                        <span className="text-sm text-muted-foreground">/mo</span>
                      )}
                      {billingCycle === "yearly" && price > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (billed yearly)
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">
                      {plan.monthlyCredits.toLocaleString()} credits/month
                    </div>
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((feature) => (
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
                        {price === 0 ? "Start Free" : "Get Started"}
                      </Link>
                    </Button>
                  </motion.div>
                );
              })}
        </div>

        {/* Feature Comparison */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Compare Plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-1/3">
                    Feature
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium">Starter</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-brand-500">
                    Pro
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium">Business</th>
                  <th className="text-center py-3 px-4 text-sm font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature) => (
                  <tr key={feature.name} className="border-b last:border-0">
                    <td className="py-3 px-4 text-sm">{feature.name}</td>
                    <td className="py-3 px-4 text-center">
                      <CellValue value={feature.starter} />
                    </td>
                    <td className="py-3 px-4 text-center bg-brand-500/5">
                      <CellValue value={feature.pro} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <CellValue value={feature.business} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <CellValue value={feature.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Credit Packages */}
        {creditPackages.length > 0 && (
          <div className="mb-20">
            <h2 className="text-2xl font-bold text-center mb-4">Need More Credits?</h2>
            <p className="text-muted-foreground text-center mb-8">
              Purchase credit packages anytime. Credits never expire.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {creditPackages.map((pkg, index) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative rounded-xl border bg-card p-5 text-center ${
                    pkg.isPopular ? "ring-2 ring-accent-gold shadow-md" : ""
                  }`}
                >
                  {pkg.isPopular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-accent-gold text-white text-xs font-medium">
                      Best Value
                    </div>
                  )}
                  <div className="text-2xl font-bold">
                    {pkg.credits.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">credits</div>
                  {pkg.bonus > 0 && (
                    <div className="text-xs text-emerald-500 font-medium mb-3">
                      +{pkg.bonus.toLocaleString()} bonus
                    </div>
                  )}
                  <div className="text-lg font-semibold mb-4">{pkg.priceFormatted}</div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/register">Buy</Link>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
    </div>
  );
}
