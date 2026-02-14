"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Eye,
  DollarSign,
  Megaphone,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Gift,
  Target,
  ShieldCheck,
  Zap,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EarnCreditsPreview } from "@/components/illustrations/earn-credits-preview";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const steps = [
  {
    icon: Eye,
    title: "View Content",
    description:
      "Browse sponsored posts and watch video ads in your feed. Each interaction earns you credits automatically.",
    color: "bg-brand-500",
    credits: "+3 to +10 per view",
  },
  {
    icon: DollarSign,
    title: "Earn Credits",
    description:
      "Credits accumulate in your account as you engage with content. Track your daily progress and total balance in real time.",
    color: "bg-emerald-500",
    credits: "Up to 100/day",
  },
  {
    icon: Megaphone,
    title: "Boost Your Business",
    description:
      "Spend credits to promote your own posts, run ad campaigns, and generate AI content — all without spending real money.",
    color: "bg-accent-purple",
    credits: "25–100 credits per action",
  },
];

const benefits = [
  {
    icon: Gift,
    title: "Free Advertising",
    description:
      "Promote your business without a marketing budget. Earn credits daily and convert them into real ad impressions.",
  },
  {
    icon: Sparkles,
    title: "AI Content at No Cost",
    description:
      "Use credits to generate AI-powered posts, captions, and ad copy. Professional content creation, funded by your engagement.",
  },
  {
    icon: TrendingUp,
    title: "Grow Your Reach",
    description:
      "Boost posts to reach new audiences. The more you engage, the more you can promote — creating a cycle of growth.",
  },
  {
    icon: ShieldCheck,
    title: "Fair & Transparent",
    description:
      "Clear earning rates, real-time tracking, and no hidden fees. You always know exactly what you're earning and spending.",
  },
  {
    icon: Zap,
    title: "Instant Rewards",
    description:
      "Credits are added to your account immediately after each qualifying interaction. No waiting, no minimum thresholds.",
  },
  {
    icon: RefreshCw,
    title: "Self-Sustaining Ecosystem",
    description:
      "Advertisers fund the credits pool. Viewers earn from engagement. Everyone benefits from a thriving community.",
  },
];

const spendOptions = [
  {
    icon: Megaphone,
    title: "Boost a Post",
    cost: "50 credits",
    description: "Push your post to more feeds and increase visibility.",
    color: "text-brand-500",
    bg: "bg-brand-500/10",
  },
  {
    icon: Sparkles,
    title: "AI Content Generation",
    cost: "25 credits",
    description: "Generate professional posts, captions, and ad copy with AI.",
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
  },
  {
    icon: Target,
    title: "Promote Campaign",
    cost: "100 credits",
    description: "Run a targeted ad campaign to reach your ideal audience.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Analytics Boost",
    cost: "30 credits",
    description: "Unlock detailed analytics and insights for your content.",
    color: "text-accent-gold",
    bg: "bg-accent-gold/10",
  },
];

export function ViewToEarnContent() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-gold/10 text-accent-gold text-sm font-medium mb-8">
              <Gift className="w-4 h-4" />
              <span>View-to-Earn Credits</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
              Earn Credits by Viewing,{" "}
              <span className="gradient-gold">
                Grow Your Business
              </span>{" "}
              for Free
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Watch content, earn credits, and use them to promote your business
              with ads, AI-generated content, and boosted campaigns — all
              without spending a dime.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start Earning Credits
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Preview */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <EarnCreditsPreview />
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold mb-4"
            >
              How It Works
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Three simple steps to turn your engagement into real business
              growth.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-8"
          >
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                className="relative text-center"
              >
                {/* Step number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-card border-2 border-brand-500 flex items-center justify-center text-xs font-bold text-brand-500">
                  {index + 1}
                </div>

                <div className="pt-6 p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow">
                  <div
                    className={`w-14 h-14 rounded-xl ${step.color} flex items-center justify-center mx-auto mb-4`}
                  >
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {step.description}
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
                    <DollarSign className="w-3 h-3 text-emerald-500" />
                    {step.credits}
                  </div>
                </div>

                {/* Arrow connector */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 translate-x-0">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How to Spend Credits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold mb-4"
            >
              Spend Credits, Grow Your Business
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Use your earned credits across the platform to promote your
              content, generate AI-powered ads, and reach new audiences.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 gap-6"
          >
            {spendOptions.map((option) => (
              <motion.div
                key={option.title}
                variants={fadeUp}
                className="group flex items-start gap-4 p-6 rounded-xl bg-card border hover:shadow-lg transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${option.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                >
                  <option.icon className={`w-6 h-6 ${option.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{option.title}</h3>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted whitespace-nowrap">
                      {option.cost}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold mb-4"
            >
              Why View-to-Earn Works
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              A win-win ecosystem where engagement fuels business growth for
              everyone.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {benefits.map((benefit) => (
              <motion.div
                key={benefit.title}
                variants={fadeUp}
                className="p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow"
              >
                <benefit.icon className="w-8 h-8 text-brand-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-br from-accent-gold/10 via-brand-500/10 to-accent-purple/10 border">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Start Earning Credits Today
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Join FlowSmartly and turn your daily browsing into free
                advertising for your business. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Create Free Account
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/pricing">View Plans</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
