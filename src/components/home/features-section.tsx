"use client";

import {
  BarChart3,
  CheckCircle2,
  Mail,
  Megaphone,
  Send,
  Share2,
} from "lucide-react";
import { CampaignWorkflowVisual } from "@/components/home/home-ui-previews";

const featureCards = [
  {
    icon: Mail,
    title: "Email + SMS Campaigns",
    description:
      "Build branded email and SMS campaigns with AI-assisted copy, clear consent, and real-time engagement signals.",
    accent: "from-pink-500 to-rose-500",
    detail: "Message orchestration",
  },
  {
    icon: Share2,
    title: "FlowSocial & Share Hub",
    description:
      "Plan once, adapt captions, and publish across the channels your audience already uses.",
    accent: "from-violet-500 to-indigo-500",
    detail: "Cross-channel calendar",
  },
  {
    icon: Megaphone,
    title: "Ad Campaigns",
    description:
      "Turn top posts into targeted campaigns with clearer creative, budget, and performance context.",
    accent: "from-emerald-500 to-teal-500",
    detail: "Audience builder",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description:
      "See what is working, what needs attention, and where to invest the next campaign dollar.",
    accent: "from-sky-500 to-cyan-500",
    detail: "Live growth signal",
  },
];

const workflowSteps = [
  "Brief the campaign",
  "Generate channel-ready content",
  "Publish, message, and measure",
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14"
    >
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.12),transparent_62%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Product capabilities
          </p>
          <h2 className="text-balance text-2xl font-black sm:text-3xl lg:text-4xl">
            Top-tier workflows without the visual clutter
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            FlowSmartly brings the human operator, AI content, social sharing,
            messaging, ads, and analytics into one connected workspace.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <article className="lg:col-span-7">
            <CampaignWorkflowVisual />
          </article>

          <article className="rounded-lg border bg-card p-6 text-foreground shadow-sm lg:col-span-5 lg:p-8 dark:bg-zinc-950 dark:text-zinc-50">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-white/10 dark:text-brand-300">
              <Send className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold">
              From idea to customer touchpoint
            </h3>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              A campaign can move from AI draft to social post, email, SMS,
              and ad promotion without changing tools.
            </p>
            <div className="mt-6 space-y-3">
              {workflowSteps.map((step, index) => (
                <div key={step} className="grid grid-cols-[36px_1fr] items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground dark:bg-zinc-800 dark:text-zinc-50">
                    {index + 1}
                  </div>
                  <div className="rounded-lg border bg-background px-4 py-3 text-sm font-semibold dark:bg-zinc-900">
                    {step}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg border bg-background p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Campaign readiness</span>
                <span className="font-bold text-emerald-500">94%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-brand-400 to-emerald-300" />
              </div>
            </div>
          </article>
        </div>

        <div className="mt-4 grid auto-rows-fr items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => (
            <article
              key={feature.title}
              className="group flex h-full min-h-[260px] flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`h-24 shrink-0 bg-gradient-to-br ${feature.accent} p-4 text-white`}
              >
                <div className="flex items-center justify-between gap-3">
                  <feature.icon className="h-7 w-7 shrink-0" />
                  <span className="rounded-md bg-white/18 px-2.5 py-1 text-right text-xs font-semibold">
                    {feature.detail}
                  </span>
                </div>
                <div className="mt-5 flex gap-2">
                  <div className="h-2 flex-1 rounded-full bg-white/70" />
                  <div className="h-2 flex-[0.6] rounded-full bg-white/35" />
                  <div className="h-2 flex-[0.35] rounded-full bg-white/25" />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4 xl:p-5">
                <h3 className="text-lg font-bold leading-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
