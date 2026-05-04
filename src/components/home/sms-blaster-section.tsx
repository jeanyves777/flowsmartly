"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { MessagingComplianceVisual } from "@/components/home/home-ui-previews";

const channelRows = [
  { label: "Welcome email", value: "42% open rate", icon: Mail },
  { label: "SMS reminder", value: "Sent with consent", icon: MessageSquare },
  { label: "Opt-out guardrails", value: "Always active", icon: ShieldCheck },
];

export function SmsBlasterSection() {
  return (
    <section className="relative overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-50/80 to-transparent dark:from-sky-950/20" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
              <MessageSquare className="h-4 w-4" />
              Email and SMS
            </span>
            <h2 className="text-balance text-2xl font-black sm:text-3xl lg:text-4xl">
              Send customer messages without losing compliance control
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Build campaigns, follow-ups, reminders, and broadcasts with AI
              content support and consent-aware sending paths.
            </p>

            <div className="mt-6 grid gap-3">
              {channelRows.map((row) => (
                <div key={row.label} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    <row.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{row.label}</div>
                    <div className="text-sm text-muted-foreground">{row.value}</div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              ))}
            </div>

            <Link
              href="/marketing-compliance"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-3 font-semibold transition-colors hover:bg-muted"
            >
              View compliance details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <MessagingComplianceVisual />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
