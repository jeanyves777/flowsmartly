import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  CreditCard,
  Package,
  Palette,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

export const metadata: Metadata = {
  title: "FlowShop - AI-Powered Online Store",
  description:
    "Launch a polished online store with AI product copy, secure checkout, order tracking, analytics, and promotion tools.",
};

const heroStats = [
  { value: "10", label: "storefront themes" },
  { value: "AI", label: "copy, SEO, pricing" },
  { value: "20", label: "products included" },
];

const featureCards = [
  {
    icon: Palette,
    title: "Storefront Builder",
    description: "Launch a mobile-ready storefront with brand colors, product sections, and polished layouts.",
    accent: "from-violet-500 to-indigo-500",
  },
  {
    icon: Package,
    title: "Product Catalog",
    description: "Manage products, variants, media, pricing, inventory, and rich product pages in one place.",
    accent: "from-sky-500 to-cyan-500",
  },
  {
    icon: CreditCard,
    title: "Secure Checkout",
    description: "Accept payments with a clean checkout flow and clear order confirmation experience.",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    icon: Truck,
    title: "Fulfillment Flow",
    description: "Track orders, customer updates, delivery status, and fulfillment readiness from the dashboard.",
    accent: "from-orange-400 to-amber-500",
  },
  {
    icon: Brain,
    title: "AI Commerce Assist",
    description: "Generate product copy, SEO metadata, bundles, pricing notes, and campaign angles faster.",
    accent: "from-pink-500 to-rose-500",
  },
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description: "See orders, conversion signals, top products, and campaign performance without extra tools.",
    accent: "from-blue-500 to-violet-500",
  },
];

const launchSteps = [
  {
    title: "Choose the store style",
    description: "Pick a theme, add your logo, and match the storefront to the brand customers already know.",
  },
  {
    title: "Add products with AI help",
    description: "Upload the basics, then let FlowShop shape descriptions, SEO, bundles, and launch copy.",
  },
  {
    title: "Sell, fulfill, and promote",
    description: "Orders, checkout, delivery status, product analytics, and promotion ideas stay connected.",
  },
];

const aiSignals = [
  { icon: Search, title: "SEO metadata", value: "Auto drafted" },
  { icon: Star, title: "Product bundles", value: "Suggested" },
  { icon: Zap, title: "Trend timing", value: "Monitored" },
  { icon: ShieldCheck, title: "Checkout trust", value: "Ready" },
];

const includedFeatures = [
  "No separate FlowShop subscription",
  "20 product listings included",
  "Unlock 5 more listings for 50 credits",
  "Product management with AI",
  "Mobile-first storefront",
  "Secure checkout tools",
];

export default function FlowShopPage() {
  return (
    <div className="overflow-x-hidden bg-background">
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50/70 via-background to-background px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 dark:from-zinc-950 dark:via-background">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border bg-card/85 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur">
              <ShoppingBag className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              FlowShop e-commerce
            </div>
            <h1 className="max-w-3xl text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-5xl">
              Launch a store that looks ready for real customers
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              FlowShop brings storefront design, product copy, secure checkout,
              order tracking, and campaign intelligence into one commerce workspace.
            </p>

            <div className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row">
              <Link
                href="/login?redirect=/ecommerce"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 px-7 text-base font-bold text-white shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-700"
              >
                Start your store
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border bg-card px-7 text-base font-bold shadow-sm transition-colors hover:bg-muted"
              >
                See pricing
              </Link>
            </div>

            <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="text-2xl font-black tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[440px] overflow-visible sm:min-h-[560px]">
            <div className="absolute left-5 top-5 z-10 rounded-lg border bg-card/90 px-4 py-3 shadow-sm dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Orders ready
              </div>
            </div>
            <Image
              src={illustrationImages.flowShopPageMerchant}
              alt="A small business merchant packing an online order with FlowShop commerce dashboards"
              fill
              priority
              sizes="(min-width: 1024px) 720px, 96vw"
              unoptimized
              className="object-contain object-bottom pt-14 drop-shadow-[0_30px_70px_rgba(76,29,149,0.22)]"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
            <article className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-600 text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
                Product pages, checkout, and promotion work together
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Instead of sending merchants through separate design, copy,
                checkout, fulfillment, and analytics tools, FlowShop keeps the
                whole launch path in one place.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {["AI product copy", "Secure checkout", "Order tracking", "Campaign ideas"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 font-semibold">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
              <p className="mb-5 text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                Live commerce snapshot
              </p>
              <div className="grid gap-3">
                {[
                  ["Today's orders", "128", "+22% from last week"],
                  ["Checkout conversion", "8.4%", "secure payment flow"],
                  ["AI product updates", "36", "drafted this week"],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-lg border bg-background p-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="mt-1 text-3xl font-black tracking-tight">{value}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                        {detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-muted/35 px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
              FlowShop toolkit
            </p>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
              Everything a small store needs to feel established
            </h2>
          </div>
          <div className="grid auto-rows-fr gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <article key={feature.title} className="flex min-h-[300px] flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className={`h-24 bg-gradient-to-br ${feature.accent} p-5 text-white`}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                Launch workflow
              </p>
              <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
                From first product to first order without tool sprawl
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                FlowShop is built around the real merchant sequence: prepare the
                store, publish the products, sell, fulfill, and improve.
              </p>
            </div>
            <div className="grid gap-4">
              {launchSteps.map((step, index) => (
                <article key={step.title} className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{step.title}</h3>
                      <p className="mt-1 leading-7 text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/35 px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                AI commerce intelligence
              </p>
              <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
                Smart suggestions around the products you already sell
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                FlowShop helps merchants move faster by turning product and
                sales data into useful next steps for copy, pricing, SEO, and
                promotion.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {aiSignals.map((signal) => (
                <article key={signal.title} className="rounded-lg border bg-card p-5 shadow-sm">
                  <signal.icon className="mb-5 h-6 w-6 text-violet-600 dark:text-violet-300" />
                  <p className="text-sm text-muted-foreground">{signal.title}</p>
                  <p className="mt-1 text-2xl font-black tracking-tight">{signal.value}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
              FlowShop access
            </p>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
              Included with your active FlowSmartly account
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Start with a professional store at no extra monthly store fee. Keep the catalog lean with 20 included product listings, then unlock more capacity with credits as you grow.
            </p>
          </div>
          <article className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
              <div>
                <h3 className="text-xl font-bold">FlowShop Free Access</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-5xl font-black tracking-tight">$0</span>
                  <span className="pb-2 text-sm text-muted-foreground">/month store fee</span>
                </div>
                <p className="mt-3 text-muted-foreground">
                  Available to FlowSmartly users with an active account. Store capacity grows by credit unlocks instead of a store subscription.
                </p>
                <Link
                  href="/login?redirect=/ecommerce"
                  className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 font-bold text-white transition-colors hover:bg-violet-700"
                >
                  Activate FlowShop
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {includedFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 rounded-lg border bg-background p-4 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section className="bg-background px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
            <div className="bg-gradient-to-br from-violet-50 to-cyan-50 p-8 sm:p-10 lg:p-12 dark:from-zinc-950 dark:to-slate-950">
              <h2 className="max-w-3xl text-balance text-2xl font-black tracking-tight sm:text-4xl">
                Ready to launch your store with FlowShop?
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Build the storefront, publish the products, and keep the first
                campaigns connected to orders from day one.
              </p>
              <Link
                href="/login?redirect=/ecommerce"
                className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 px-7 text-base font-bold text-white shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-700"
              >
                Get started free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="grid gap-4 border-t bg-muted/35 p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              {["No card required to start", "Secure checkout included", "AI product support built in"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border bg-card p-4 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
