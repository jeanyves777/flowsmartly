"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

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

const fallbackPlans: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    description: "Start creating and testing the platform.",
    monthlyCredits: 100,
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    features: ["AI content basics", "Social sharing", "Starter analytics", "Single user"],
    isPopular: false,
    color: null,
    icon: null,
  },
  {
    id: "PRO",
    name: "Pro",
    description: "For solo operators growing every week.",
    monthlyCredits: 5000,
    priceCentsMonthly: 2900,
    priceCentsYearly: 27840,
    features: ["Advanced AI content", "Email campaigns", "Priority support", "3 team members"],
    isPopular: true,
    color: null,
    icon: null,
  },
  {
    id: "BUSINESS",
    name: "Business",
    description: "For teams running multiple channels.",
    monthlyCredits: 25000,
    priceCentsMonthly: 9900,
    priceCentsYearly: 95040,
    features: ["SMS campaigns", "Advanced analytics", "Custom branding", "10 team members"],
    isPopular: false,
    color: null,
    icon: null,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "For larger teams and managed growth.",
    monthlyCredits: 100000,
    priceCentsMonthly: 29900,
    priceCentsYearly: 287040,
    features: ["Unlimited workflows", "API access", "Dedicated support", "Custom onboarding"],
    isPopular: false,
    color: null,
    icon: null,
  },
];

const fallbackCreditPackages: CreditPackage[] = [
  {
    id: "credit-1",
    name: "Starter Pack",
    credits: 1000,
    bonus: 0,
    priceCents: 1200,
    priceFormatted: "$12",
    isPopular: false,
  },
  {
    id: "credit-2",
    name: "Growth Pack",
    credits: 5000,
    bonus: 500,
    priceCents: 4900,
    priceFormatted: "$49",
    isPopular: true,
  },
  {
    id: "credit-3",
    name: "Scale Pack",
    credits: 15000,
    bonus: 2500,
    priceCents: 12900,
    priceFormatted: "$129",
    isPopular: false,
  },
];

const planIcons: Record<string, LucideIcon> = {
  STARTER: Sparkles,
  PRO: Zap,
  BUSINESS: Building2,
  ENTERPRISE: Rocket,
};

const planStyles: Record<string, string> = {
  STARTER: "from-zinc-500 to-zinc-700",
  PRO: "from-sky-500 to-violet-500",
  BUSINESS: "from-emerald-500 to-cyan-500",
  ENTERPRISE: "from-amber-500 to-rose-500",
};

const comparisonFeatures = [
  { name: "AI content generation", starter: true, pro: true, business: true, enterprise: true },
  { name: "Social publishing", starter: true, pro: true, business: true, enterprise: true },
  { name: "Monthly credits", starter: "100", pro: "5,000", business: "25,000", enterprise: "Custom" },
  { name: "Email campaigns", starter: false, pro: true, business: true, enterprise: true },
  { name: "SMS campaigns", starter: false, pro: false, business: true, enterprise: true },
  { name: "Team members", starter: "1", pro: "3", business: "10", enterprise: "Custom" },
  { name: "Analytics", starter: "Basic", pro: "Advanced", business: "Advanced", enterprise: "Custom" },
  { name: "API access", starter: false, pro: false, business: true, enterprise: true },
  { name: "Priority support", starter: false, pro: true, business: true, enterprise: true },
  { name: "Custom branding", starter: false, pro: false, business: true, enterprise: true },
];

const faqs = [
  {
    question: "Can I change plans later?",
    answer:
      "Yes. You can upgrade or downgrade anytime. Upgrades are prorated for the remaining billing period, and downgrades take effect at the next renewal.",
  },
  {
    question: "What happens to unused credits?",
    answer:
      "Plan credits roll over for up to 3 months on paid plans. Purchased credit packages do not expire.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Paid plans include a 14-day money-back guarantee. If the platform is not a fit, contact support and we will help.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel from account settings and keep access until the end of the current billing period.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "FlowSmartly uses secure payment processing for major cards and supported wallet payment methods.",
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-300" />
    ) : (
      <X className="mx-auto h-4 w-4 text-muted-foreground/45" />
    );
  }

  return <span className="text-sm font-medium">{value}</span>;
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function formatPrice(cents: number) {
  if (cents === 0) {
    return "Free";
  }

  return `$${(cents / 100).toFixed(0)}`;
}

export function PricingPageContent() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/payments/packages")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.data) {
          setPlans(data.data.plans || []);
          setCreditPackages(data.data.creditPackages || []);
        }
      })
      .catch(() => {
        setPlans(fallbackPlans);
        setCreditPackages(fallbackCreditPackages);
      })
      .finally(() => setLoading(false));
  }, []);

  const visiblePlans = plans.length > 0 ? plans : fallbackPlans;
  const visibleCreditPackages =
    creditPackages.length > 0 ? creditPackages : fallbackCreditPackages;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,1))] px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-24 lg:px-8 dark:bg-[linear-gradient(180deg,rgba(11,18,32,1),rgba(9,9,11,1))]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm">
              <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-300" />
              Transparent pricing
            </div>
            <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Pick the plan that matches your next stage
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Start free, grow into more credits and channels, and add extra
              usage only when campaigns need it. The pricing story stays simple
              even as your workspace gets stronger.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-sky-600 font-semibold text-white hover:bg-sky-700" asChild>
                <Link href="/register">
                  Start free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="font-semibold" asChild>
                <Link href="#plans">Compare plans</Link>
              </Button>
            </div>
            <div className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
              {[
                ["Free", "starter access"],
                ["20%", "yearly savings"],
                ["4", "growth tiers"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative min-h-[430px] overflow-visible sm:min-h-[560px]">
              <div className="absolute left-4 top-4 z-10 rounded-lg border bg-card/90 px-4 py-3 text-sm font-semibold shadow-sm">
                Plan fit review
              </div>
              <Image
                src={illustrationImages.pricingPageOperator}
                alt="Business operator comparing pricing plans, credits, billing, and team options"
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                unoptimized
                className="object-contain object-center drop-shadow-[0_30px_70px_rgba(15,23,42,0.2)] dark:drop-shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
              />
              <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["Credits", "usage based"],
                  ["Seats", "team ready"],
                  ["Savings", "yearly option"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-lg border bg-card/90 px-4 py-3 shadow-sm"
                  >
                    <div className="text-xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="plans" className="scroll-mt-28 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Plans"
            title="Start lean, then scale credits and channels"
            description="The cards keep the plan choice direct while preserving live package data from the product API."
          />

          <div className="mt-10 flex justify-center">
            <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm">
              {[
                { id: "monthly", label: "Monthly" },
                { id: "yearly", label: "Yearly", badge: "Save 20%" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBillingCycle(item.id as "monthly" | "yearly")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                    billingCycle === item.id
                      ? "bg-sky-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        billingCycle === item.id
                          ? "bg-white/18 text-white"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="mb-5 h-12 w-12 animate-pulse rounded-lg bg-muted" />
                    <div className="mb-3 h-6 w-28 animate-pulse rounded bg-muted" />
                    <div className="mb-6 h-9 w-24 animate-pulse rounded bg-muted" />
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((__, itemIndex) => (
                        <div key={itemIndex} className="h-4 animate-pulse rounded bg-muted" />
                      ))}
                    </div>
                  </div>
                ))
              : visiblePlans.map((plan) => {
                  const Icon = planIcons[plan.id] || Sparkles;
                  const gradient = planStyles[plan.id] || "from-sky-500 to-violet-500";
                  const yearlyMonthlyPrice = Math.round(plan.priceCentsYearly / 12);
                  const price =
                    billingCycle === "monthly"
                      ? plan.priceCentsMonthly
                      : yearlyMonthlyPrice;

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex rounded-lg border bg-card p-6 shadow-sm ${
                        plan.isPopular ? "ring-2 ring-sky-500" : ""
                      }`}
                    >
                      {plan.isPopular && (
                        <div className="absolute -top-3 left-6 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                          Most popular
                        </div>
                      )}
                      <div className="flex w-full flex-col">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="mt-5 text-xl font-semibold">{plan.name}</h3>
                        {plan.description && (
                          <p className="mt-2 min-h-14 leading-7 text-muted-foreground">
                            {plan.description}
                          </p>
                        )}
                        <div className="mt-6 flex items-end gap-2">
                          <span className="text-4xl font-bold">{formatPrice(price)}</span>
                          {price > 0 && (
                            <span className="pb-1 text-sm text-muted-foreground">/mo</span>
                          )}
                        </div>
                        {billingCycle === "yearly" && price > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">Billed yearly</p>
                        )}
                        <div className="mt-5 rounded-lg border bg-background p-4 dark:bg-muted/30">
                          <p className="text-sm font-semibold">
                            {plan.monthlyCredits.toLocaleString()} credits/month
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            For AI, campaigns, boosts, and reporting actions.
                          </p>
                        </div>
                        <ul className="mt-6 flex-1 space-y-3">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex gap-2 text-sm">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          className="mt-6 w-full"
                          variant={plan.isPopular ? "default" : "outline"}
                          asChild
                        >
                          <Link href="/register">
                            {price === 0 ? "Start free" : "Get started"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Comparison"
            title="See what changes as your workspace grows"
            description="The comparison table keeps a dense pricing decision readable without forcing users through long copy."
          />
          <div className="mt-10 overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b bg-muted/55">
                    <th className="w-[34%] px-4 py-4 text-left text-sm font-semibold text-muted-foreground">
                      Feature
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold">Starter</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-sky-600 dark:text-sky-300">
                      Pro
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold">Business</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature) => (
                    <tr key={feature.name} className="border-b last:border-0">
                      <td className="px-4 py-4 text-sm font-medium">{feature.name}</td>
                      <td className="px-4 py-4 text-center"><CellValue value={feature.starter} /></td>
                      <td className="bg-sky-500/5 px-4 py-4 text-center"><CellValue value={feature.pro} /></td>
                      <td className="px-4 py-4 text-center"><CellValue value={feature.business} /></td>
                      <td className="px-4 py-4 text-center"><CellValue value={feature.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                  Extra credits
                </p>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Add usage without changing plans
                </h2>
              </div>
            </div>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Credit packages keep seasonal launches and one-off campaigns from
              forcing a plan change. Buy what you need, keep the core plan stable.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border bg-background p-4 dark:bg-muted/30">
                <BarChart3 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                <p className="mt-3 font-semibold">Track usage by action</p>
              </div>
              <div className="rounded-lg border bg-background p-4 dark:bg-muted/30">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                <p className="mt-3 font-semibold">Share credits with teams</p>
              </div>
              <div className="rounded-lg border bg-background p-4 dark:bg-muted/30">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <p className="mt-3 font-semibold">Keep spend visible</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {visibleCreditPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-lg border bg-card p-6 text-center shadow-sm ${
                  pkg.isPopular ? "ring-2 ring-emerald-500" : ""
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    Best value
                  </div>
                )}
                <p className="text-sm font-semibold text-muted-foreground">{pkg.name}</p>
                <div className="mt-3 text-4xl font-bold">{pkg.credits.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">credits</p>
                {pkg.bonus > 0 && (
                  <p className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                    +{pkg.bonus.toLocaleString()} bonus
                  </p>
                )}
                <div className="mt-6 text-2xl font-bold">{pkg.priceFormatted}</div>
                <Button className="mt-6 w-full" variant="outline" asChild>
                  <Link href="/register">Buy credits</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Questions"
            title="Plan details without the fine-print headache"
            description="Clear answers help the pricing page feel professional and reduce friction before signup."
          />
          <Accordion type="single" collapsible className="mt-10 w-full rounded-lg border bg-card px-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-lg border bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(16,185,129,0.12),rgba(139,92,246,0.10))] p-8 text-center shadow-sm sm:p-12 dark:bg-card">
          <CreditCard className="mx-auto h-10 w-10 text-sky-600 dark:text-sky-300" />
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Start free, then scale when the work proves it
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Choose a plan, test your first campaigns, and add credits only when
            your next growth push needs more capacity.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="bg-sky-600 font-semibold text-white hover:bg-sky-700" asChild>
              <Link href="/register">
                Start free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link href="/register?plan=enterprise">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
