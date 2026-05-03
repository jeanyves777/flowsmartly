"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const proofItems = ["No credit card required", "Free workspace", "Upgrade when ready"];

export function CTASection() {
  return (
    <section className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden p-8 sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_38%),radial-gradient(circle_at_82%_70%,rgba(20,184,166,0.12),transparent_42%)]" />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm font-semibold shadow-sm">
                <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                Start with one campaign
              </div>
              <h2 className="max-w-3xl text-balance text-3xl font-black tracking-tight sm:text-5xl">
                Bring your content, commerce, local listings, and experts into one flow
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Open a FlowSmartly workspace, draft the first campaign, and keep
                publishing, messaging, selling, and reporting in the same place.
              </p>
              <div className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <div className="flex min-h-14 flex-1 items-center rounded-lg border bg-background px-4 text-sm text-muted-foreground shadow-sm">
                  <MessageSquare className="mr-3 h-5 w-5" />
                  Enter your email
                </div>
                <Button size="lg" className="min-h-14 px-7 font-bold" asChild>
                  <Link href="/register">
                    Try for free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {proofItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t bg-muted/35 p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <div className="grid gap-4">
              {[
                ["1", "Create a campaign brief", "Brand voice, channel, and offer in one place"],
                ["2", "Publish across the flow", "Social, email, SMS, commerce, and ads stay connected"],
                ["3", "Measure what moves", "See the signals your next campaign should use"],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-lg border bg-card p-5">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-black text-white">
                      {number}
                    </div>
                    <div>
                      <p className="font-bold">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
