import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

export const metadata: Metadata = {
  title: "ListSmartly - AI-Powered Local Presence Management | FlowSmartly",
  description:
    "Sync business listings across directories, monitor reviews, and keep local search information accurate with AI support.",
};

const heroStats = [
  { value: "161", label: "directories covered" },
  { value: "AI", label: "auto-fix support" },
  { value: "$7", label: "starter plan" },
];

const problems = [
  "Wrong hours and phone numbers spread across directories",
  "Duplicate listings weaken local search trust",
  "Reviews sit unanswered across different platforms",
  "Owners lose time checking every profile manually",
];

const solutions = [
  "Sync accurate business info from one dashboard",
  "Monitor listing drift and duplicate issues",
  "Draft review responses with brand-safe AI help",
  "Track presence score and local visibility over time",
];

const featureCards = [
  {
    icon: RefreshCw,
    title: "Listing Sync",
    description: "Push accurate name, address, phone, hours, links, and categories across high-value directories.",
    accent: "from-teal-500 to-cyan-500",
  },
  {
    icon: Sparkles,
    title: "AI Autopilot",
    description: "Watch for outdated fields, duplicate listings, missing profiles, and suggested corrections.",
    accent: "from-cyan-500 to-sky-500",
  },
  {
    icon: MessageSquare,
    title: "Review Command",
    description: "Bring review monitoring, sentiment, response drafts, and reputation health into one view.",
    accent: "from-blue-500 to-indigo-500",
  },
  {
    icon: BarChart3,
    title: "Presence Analytics",
    description: "See citation score, review movement, directory status, and monthly local visibility signals.",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    icon: Search,
    title: "Local Search Signals",
    description: "Understand which profiles, categories, and review patterns are helping customers find you.",
    accent: "from-violet-500 to-purple-500",
  },
  {
    icon: ShieldCheck,
    title: "Owner Controls",
    description: "Approve important changes, view sync history, and keep the final say over public business data.",
    accent: "from-emerald-500 to-teal-500",
  },
];

const directories = [
  "Google Business",
  "Apple Maps",
  "Bing Places",
  "Yelp",
  "Facebook",
  "Tripadvisor",
  "Foursquare",
  "Waze",
  "YellowPages",
  "MapQuest",
  "Nextdoor",
  "BBB",
  "Manta",
  "Superpages",
  "Local.com",
  "Angi",
];

const workflow = [
  {
    title: "Add the source of truth",
    description: "Enter business details once: address, phone, hours, service areas, categories, and website.",
  },
  {
    title: "Scan and sync profiles",
    description: "ListSmartly checks for gaps, duplicates, and mismatches, then queues updates for directories.",
  },
  {
    title: "Monitor reviews and drift",
    description: "The dashboard keeps review health, profile accuracy, and AI-suggested next steps visible.",
  },
];

const basicFeatures = [
  "Requires an active FlowSmartly plan",
  "Sync to 150+ directories",
  "Citation score dashboard",
  "AI drift monitoring",
  "No standalone ListSmartly payment",
];

const proFeatures = [
  "Runs from available user credits",
  "Review response drafts",
  "Competitor tracking",
  "Monthly AI reports",
  "Bulk update tools",
];

export default function ListSmartlyDetailsPage() {
  return (
    <div className="overflow-x-hidden bg-background">
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/75 via-background to-background px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 dark:from-zinc-950 dark:via-background">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border bg-card/85 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur">
              <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-300" />
              ListSmartly local presence
            </div>
            <h1 className="max-w-3xl text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-5xl">
              Keep every local profile accurate and review-ready
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              ListSmartly helps business owners sync listings, monitor reviews,
              catch profile drift, and understand local visibility from one
              AI-assisted command center.
            </p>

            <div className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-teal-600 px-7 text-base font-bold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700"
              >
                Get started free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border bg-card px-7 text-base font-bold shadow-sm transition-colors hover:bg-muted"
              >
                View pricing
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
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                Local profiles live
              </div>
            </div>
            <Image
              src={illustrationImages.listSmartlyPageOwner}
              alt="A local business owner using ListSmartly to manage listings and reviews"
              fill
              priority
              sizes="(min-width: 1024px) 720px, 96vw"
              unoptimized
              className="object-contain object-bottom pt-14 drop-shadow-[0_30px_70px_rgba(15,118,110,0.2)]"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-300">
                <X className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">The local search problem is messy</h2>
              <div className="mt-6 grid gap-3">
                {problems.map((problem) => (
                  <div key={problem} className="flex gap-3 rounded-lg border bg-background p-4">
                    <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <span className="text-muted-foreground">{problem}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600 text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">ListSmartly gives owners one control point</h2>
              <div className="mt-6 grid gap-3">
                {solutions.map((solution) => (
                  <div key={solution} className="flex gap-3 rounded-lg border bg-background p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                    <span className="text-muted-foreground">{solution}</span>
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
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">
              Local presence toolkit
            </p>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
              Everything needed to keep local trust consistent
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
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">
                Directory coverage
              </p>
              <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
                Your business data should match wherever customers search
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                ListSmartly keeps core profile details consistent across the
                directories, maps, and local discovery surfaces that matter.
              </p>
              <div className="mt-8 rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <Globe className="h-6 w-6 text-teal-600 dark:text-teal-300" />
                  <div>
                    <p className="text-3xl font-black tracking-tight">161</p>
                    <p className="text-sm text-muted-foreground">directory targets and local profiles</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {directories.map((directory) => (
                  <span key={directory} className="rounded-full border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground">
                    {directory}
                  </span>
                ))}
                <span className="rounded-full bg-teal-600 px-3 py-2 text-sm font-bold text-white">
                  + more
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/35 px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">
                How it works
              </p>
              <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
                From scattered profiles to a clean local command center
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Keep the owner workflow simple: set the source of truth, sync
                the profiles, then monitor reviews and accuracy over time.
              </p>
            </div>
            <div className="grid gap-4">
              {workflow.map((step, index) => (
                <article key={step.title} className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-sm font-black text-white">
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

      <section className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">
              Included access
            </p>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-4xl">
              ListSmartly is part of the main FlowSmartly subscription
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ["First-time unlock", "500 credits", "Unlock the listing system once after a user has a FlowSmartly plan", basicFeatures],
              ["Monthly keep-active", "250 credits", "Deducted monthly from available credits to keep ListSmartly active", proFeatures],
            ].map(([name, price, description, features]) => (
              <article key={name as string} className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
                <h3 className="text-xl font-bold">{name as string}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight">{price as string}</span>
                </div>
                <p className="mt-3 text-muted-foreground">{description as string}</p>
                <ul className="mt-6 space-y-3">
                  {(features as string[]).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 font-bold text-white transition-colors hover:bg-teal-700"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
            <div className="bg-gradient-to-br from-teal-50 to-sky-50 p-8 sm:p-10 lg:p-12 dark:from-zinc-950 dark:to-slate-950">
              <h2 className="max-w-3xl text-balance text-2xl font-black tracking-tight sm:text-4xl">
                Ready to make every local profile reliable?
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Start with the source of truth, then let ListSmartly help you
                keep listings, reviews, and reports moving in one place.
              </p>
              <Link
                href="/register"
                className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-teal-600 px-7 text-base font-bold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700"
              >
                Get started free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="grid gap-4 border-t bg-muted/35 p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              {[
                ["Profile accuracy", Clock],
                ["Review visibility", Star],
                ["Directory coverage", Globe],
                ["AI recommendations", Zap],
              ].map(([item, Icon]) => {
                const ItemIcon = Icon as typeof Clock;
                return (
                  <div key={item as string} className="flex items-center gap-3 rounded-lg border bg-card p-4 font-semibold">
                    <ItemIcon className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                    {item as string}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
