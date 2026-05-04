"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Mail,
  Megaphone,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformWorkspaceVisual } from "@/components/home/home-ui-previews";

const platformTabs = [
  {
    id: "ai",
    label: "AI Studio",
    icon: Sparkles,
    title: "Turn raw ideas into campaign-ready work",
    description:
      "Draft posts, emails, ads, product copy, and campaign angles with brand context already attached.",
    stat: "6x",
    statLabel: "faster content briefs",
    accent: "from-sky-500 to-cyan-400",
    items: ["Brand voice lock", "Campaign drafts", "Approval-ready copy"],
  },
  {
    id: "share",
    label: "Share Hub",
    icon: Share2,
    title: "Move every message into the right channel",
    description:
      "Adapt one campaign into social, email, SMS, and ad-ready variations without rebuilding the work.",
    stat: "4",
    statLabel: "channels from one plan",
    accent: "from-violet-500 to-indigo-500",
    items: ["Social calendar", "Email handoff", "SMS follow-up"],
  },
  {
    id: "ads",
    label: "Ads",
    icon: Megaphone,
    title: "Promote the strongest posts with context",
    description:
      "Package high-performing ideas into ad campaigns with audience notes, budget focus, and creative status.",
    stat: "31%",
    statLabel: "clearer campaign focus",
    accent: "from-emerald-500 to-teal-500",
    items: ["Audience fit", "Creative status", "Spend readiness"],
  },
  {
    id: "report",
    label: "Analytics",
    icon: BarChart3,
    title: "Know what deserves the next move",
    description:
      "See campaign health, channel lift, and revenue signals in one place so teams can act faster.",
    stat: "94%",
    statLabel: "campaign readiness",
    accent: "from-orange-400 to-pink-500",
    items: ["Growth signals", "Channel lift", "Revenue context"],
  },
];

export function PlatformSection() {
  const [activeTab, setActiveTab] = useState(platformTabs[0].id);
  const active = platformTabs.find((tab) => tab.id === activeTab) ?? platformTabs[0];
  const ActiveIcon = active.icon;

  return (
    <section
      id="platform"
      className="relative overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14"
    >
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.11),transparent_62%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              Platform
            </p>
            <h2 className="text-balance text-2xl font-black sm:text-3xl lg:text-4xl">
              One workspace from first draft to measured growth
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
            FlowSmartly keeps the operator, the AI assistant, the campaign
            channels, and the reporting loop together so public work does not
            get scattered across disconnected tools.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 rounded-lg border bg-card p-2 shadow-sm">
          {platformTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${
                  isActive
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="rounded-lg border bg-card p-5 shadow-sm lg:p-6">
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${active.accent} text-white shadow-lg shadow-brand-500/10`}>
              <ActiveIcon className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-bold">{active.title}</h3>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {active.description}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {active.items.map((item) => (
                <div key={item} className="rounded-lg border bg-background p-4">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-500" />
                  <p className="text-sm font-semibold">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-black">{active.stat}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{active.statLabel}</p>
                </div>
                <div className="h-16 w-36 rounded-lg bg-background p-3">
                  <div className="flex h-full items-end gap-1.5">
                    {[36, 54, 42, 68, 78, 92].map((height, index) => (
                      <div
                        key={`${active.id}-${height}-${index}`}
                        className={`flex-1 rounded-full bg-gradient-to-t ${active.accent}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button asChild className="mt-5 min-h-12 px-6 font-bold">
              <Link href="/register">
                Build your first campaign
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </article>

          <article>
            <PlatformWorkspaceVisual
              label={active.label}
              title={active.title}
              stat={active.stat}
              statLabel={active.statLabel}
              accent={active.accent}
              items={active.items}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
