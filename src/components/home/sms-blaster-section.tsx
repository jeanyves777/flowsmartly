"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

const channelRows = [
  { label: "Welcome email", value: "42% open rate", icon: Mail },
  { label: "SMS reminder", value: "Sent with consent", icon: MessageSquare },
  { label: "Opt-out guardrails", value: "Always active", icon: ShieldCheck },
];

export function SmsBlasterSection() {
  return (
    <section className="relative overflow-hidden bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-sky-50/80 to-transparent dark:from-sky-950/20" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
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
            <h2 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Send customer messages without losing compliance control
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Build campaigns, follow-ups, reminders, and broadcasts with AI
              content support and consent-aware sending paths.
            </p>

            <div className="mt-8 grid gap-3">
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
              className="mt-8 inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-3 font-semibold transition-colors hover:bg-muted"
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
            className="relative min-h-[500px] overflow-visible"
          >
            <div className="absolute left-5 top-5 z-10 rounded-lg border bg-card/90 p-4 shadow-sm">
              <div className="text-sm font-semibold">Campaign health</div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-black">98%</span>
                <span className="pb-1 text-xs text-emerald-600 dark:text-emerald-300">ready</span>
              </div>
            </div>
            <Image
              src={illustrationImages.homeMessagingManager}
              alt="A customer engagement manager reviewing email and SMS campaigns"
              fill
              sizes="(min-width: 1024px) 640px, 92vw"
              unoptimized
              className="object-contain object-bottom drop-shadow-[0_28px_55px_rgba(0,0,0,0.22)]"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
