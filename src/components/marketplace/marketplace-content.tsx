"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import {
  Briefcase,
  Search,
  BarChart3,
  Handshake,
  TrendingUp,
  ShieldCheck,
  Palette,
  Users,
  DollarSign,
  Sparkles,
  Rocket,
  Layout,
  Wallet,
  Gift,
  Target,
  RefreshCw,
  Zap,
  ArrowRight,
  Star,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Quote,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketplacePreview } from "@/components/illustrations/marketplace-preview";
import { AgentProfilePreview } from "@/components/illustrations/agent-profile-preview";
import { RevenueSplitPreview } from "@/components/illustrations/revenue-split-preview";

// ── Animation Variants ──────────────────────────────────────────

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

// ── Data Arrays ─────────────────────────────────────────────────

const clientSteps = [
  {
    icon: Search,
    title: "Browse Agents",
    description: "Filter by specialty, industry, budget, and performance rating to find your perfect match.",
    color: "bg-brand-500",
  },
  {
    icon: BarChart3,
    title: "Review & Compare",
    description: "See real performance scores, client reviews, and portfolio work before you decide.",
    color: "bg-accent-purple",
  },
  {
    icon: Handshake,
    title: "Hire & Onboard",
    description: "Seamlessly hire an agent. Your subscription fee is waived while they manage your account.",
    color: "bg-emerald-500",
  },
  {
    icon: TrendingUp,
    title: "Track Results",
    description: "Monitor your agent\u2019s performance with AI-powered strategy scoring in real time.",
    color: "bg-accent-gold",
  },
];

const agentSteps = [
  {
    icon: ShieldCheck,
    title: "Apply & Get Verified",
    description: "Complete the onboarding process and get approved by our quality review team.",
    color: "bg-brand-500",
  },
  {
    icon: Palette,
    title: "Set Your Services",
    description: "Define your specialties, pricing tiers, and build your professional agent landing page.",
    color: "bg-accent-purple",
  },
  {
    icon: Users,
    title: "Manage Clients",
    description: "Use FlowSmartly\u2019s full AI platform to execute marketing strategies for your clients.",
    color: "bg-emerald-500",
  },
  {
    icon: DollarSign,
    title: "Earn & Grow",
    description: "Earn recurring revenue, collect reviews, and boost your marketplace ranking over time.",
    color: "bg-accent-gold",
  },
];

const agentBenefits = [
  {
    icon: DollarSign,
    title: "Recurring Revenue",
    description: "Earn monthly income from each client. Set your own prices with a $100/month minimum floor.",
    color: "text-emerald-500",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Tools",
    description: "Access FlowSmartly\u2019s full AI suite to deliver exceptional results for every client.",
    color: "text-brand-500",
  },
  {
    icon: BarChart3,
    title: "Performance Dashboard",
    description: "Track strategy scores, completion rates, and client satisfaction in real-time.",
    color: "text-accent-purple",
  },
  {
    icon: Rocket,
    title: "Marketing Boosts",
    description: "Promote your profile with paid boosts to appear in premium search results.",
    color: "text-accent-gold",
  },
  {
    icon: Layout,
    title: "Landing Page Builder",
    description: "Get your own customizable agent landing page to showcase your work and attract clients.",
    color: "text-pink-500",
  },
  {
    icon: Wallet,
    title: "Transparent Payouts",
    description: "80% revenue share. Clear fee structure with reliable monthly payouts via Stripe.",
    color: "text-accent-teal",
  },
];

const clientBenefits = [
  {
    icon: Gift,
    title: "Subscription Waived",
    description: "Your FlowSmartly subscription is waived while an agent manages your account.",
    color: "text-emerald-500",
  },
  {
    icon: ShieldCheck,
    title: "Vetted Professionals",
    description: "Every agent is reviewed and approved by our team before they can accept clients.",
    color: "text-brand-500",
  },
  {
    icon: Target,
    title: "AI-Backed Accountability",
    description: "Agents are scored monthly on execution quality. Underperformers get warnings.",
    color: "text-accent-purple",
  },
  {
    icon: BarChart3,
    title: "Real Performance Data",
    description: "No guesswork. See completion scores, on-time rates, and consistency metrics.",
    color: "text-accent-gold",
  },
  {
    icon: RefreshCw,
    title: "Easy Switching",
    description: "If your agent underperforms after two warnings, seamlessly switch to another.",
    color: "text-pink-500",
  },
  {
    icon: Zap,
    title: "Full Platform Access",
    description: "Keep access to all FlowSmartly features. Your agent works within the same platform.",
    color: "text-accent-teal",
  },
];

const featuredAgents = [
  {
    name: "Sarah Mitchell",
    specialty: "Social Media Strategy",
    rating: 4.9,
    reviews: 127,
    price: 250,
    industries: ["E-Commerce", "Beauty"],
    gradient: "from-accent-purple to-pink-500",
    initials: "SM",
  },
  {
    name: "James Chen",
    specialty: "Content & SEO",
    rating: 4.8,
    reviews: 89,
    price: 350,
    industries: ["SaaS", "Tech"],
    gradient: "from-brand-500 to-accent-teal",
    initials: "JC",
  },
  {
    name: "Maria Gonzalez",
    specialty: "Paid Ads & Growth",
    rating: 5.0,
    reviews: 203,
    price: 500,
    industries: ["Finance", "Real Estate"],
    gradient: "from-emerald-500 to-brand-500",
    initials: "MG",
  },
];

const timelineSteps = [
  {
    icon: CheckCircle,
    title: "Performance Monitored",
    description: "Your agent\u2019s work is continuously scored against your marketing plan goals — completion rate, on-time delivery, consistency, and content quality.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    line: "bg-emerald-500",
  },
  {
    icon: AlertTriangle,
    title: "First Warning (Month 1)",
    description: "If performance drops below threshold, the agent gets an official warning with specific improvement areas. You\u2019re notified that FlowSmartly is monitoring the situation.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    line: "bg-amber-500",
  },
  {
    icon: XCircle,
    title: "Final Warning (Month 2)",
    description: "If still underperforming, you receive a detailed report and get to choose: switch to a new agent or continue with the current one. You\u2019re always in control.",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    line: "bg-red-500",
  },
];

const testimonials = [
  {
    quote: "Hiring an agent through FlowSmartly was the best decision for my business. My engagement tripled in two months and I didn\u2019t have to lift a finger.",
    name: "Alex Rivera",
    role: "Founder, StyleBox",
    initials: "AR",
    gradient: "from-accent-purple to-pink-500",
  },
  {
    quote: "As an agent, FlowSmartly gives me everything I need — the tools, the clients, and the accountability system that builds trust with my customers.",
    name: "Priya Sharma",
    role: "Marketing Agency Owner",
    initials: "PS",
    gradient: "from-brand-500 to-accent-teal",
  },
  {
    quote: "The performance scoring system is brilliant. I can see exactly how my agent is doing against my goals. Total transparency.",
    name: "David Kim",
    role: "E-Commerce Manager",
    initials: "DK",
    gradient: "from-emerald-500 to-brand-500",
  },
];

// ── Stats Banner Component ──────────────────────────────────────

const stats = [
  { value: 500, suffix: "+", label: "Verified Agents" },
  { value: 2, suffix: "M+", label: "Revenue Earned", prefix: "$" },
  { value: 98, suffix: "%", label: "Client Satisfaction" },
  { value: 50, suffix: "+", label: "Industries Served" },
];

function formatStatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

function AnimatedStat({
  value,
  suffix,
  label,
  prefix,
}: {
  value: number;
  suffix: string;
  label: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);
      setDisplay(formatStatNumber(current));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center">
      <motion.div
        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {prefix}
        {display}
        {suffix}
      </motion.div>
      <motion.div
        className="text-sm sm:text-base text-white/70 mt-2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {label}
      </motion.div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function MarketplaceContent() {
  return (
    <div className="min-h-screen">
      {/* ═══ A. Hero Section — Dark gradient variant ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="mp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mp-grid)" />
          </svg>
        </div>
        {/* Floating orbs */}
        <div className="absolute top-20 left-[15%] w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 right-[20%] w-40 h-40 bg-brand-500/20 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite_2s]" />
        <div className="absolute top-40 right-[10%] w-24 h-24 bg-teal-500/20 rounded-full blur-3xl animate-[float_5s_ease-in-out_infinite_1s]" />

        <style jsx global>{`
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 text-purple-300 text-sm font-medium mb-8 border border-purple-500/30">
              <Briefcase className="w-4 h-4" />
              <span>Agent Marketplace</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-white text-balance">
              Expert Marketing Agents,{" "}
              <span className="bg-gradient-to-r from-purple-400 to-brand-400 bg-clip-text text-transparent">
                On Demand
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              Hire vetted marketing professionals to manage your strategy, or
              become an agent and earn recurring revenue — all powered by
              FlowSmartly&apos;s AI platform.
            </p>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
              {[
                { icon: ShieldCheck, label: "Vetted Agents" },
                { icon: BarChart3, label: "Performance Tracked" },
                { icon: Users, label: "Managed Accounts" },
                { icon: Sparkles, label: "AI-Powered" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-gray-400">
                  <item.icon className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold" asChild>
                <Link href="/register">
                  Find an Agent
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                <Link href="#for-agents">Become an Agent</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Hero Illustration */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <MarketplacePreview />
          </motion.div>
        </div>
      </section>

      {/* ═══ B. Stats Banner ═══ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-accent-purple via-brand-500 to-accent-teal">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <AnimatedStat
                key={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                prefix={stat.prefix}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ C. How It Works — For Clients ═══ */}
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
              How It Works for Businesses
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Four simple steps to get expert marketing management for your
              business.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {clientSteps.map((step, index) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                className="relative text-center"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-card border-2 border-brand-500 flex items-center justify-center text-xs font-bold text-brand-500 z-10">
                  {index + 1}
                </div>

                <div className="pt-6 p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow h-full">
                  <div
                    className={`w-14 h-14 rounded-xl ${step.color} flex items-center justify-center mx-auto mb-4`}
                  >
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {index < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 translate-x-0">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ D. How It Works — For Agents ═══ */}
      <section id="for-agents" className="py-20 px-4 sm:px-6 lg:px-8">
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
              How It Works for Agents
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Join the marketplace, build your client base, and earn recurring
              revenue.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {agentSteps.map((step, index) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                className="relative text-center"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-card border-2 border-accent-purple flex items-center justify-center text-xs font-bold text-accent-purple z-10">
                  {index + 1}
                </div>

                <div className="pt-6 p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow h-full">
                  <div
                    className={`w-14 h-14 rounded-xl ${step.color} flex items-center justify-center mx-auto mb-4`}
                  >
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {index < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 translate-x-0">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>

          {/* Agent profile illustration */}
          <div className="mt-16 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <AgentProfilePreview />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ E. Agent Benefits ═══ */}
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
              Why Agents Love FlowSmartly
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Everything you need to build a thriving marketing business, all in
              one platform.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {agentBenefits.map((benefit) => (
              <motion.div
                key={benefit.title}
                variants={fadeUp}
                className="group p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow"
              >
                <benefit.icon
                  className={`w-8 h-8 ${benefit.color} mb-4 group-hover:scale-110 transition-transform`}
                />
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ F. Client Benefits ═══ */}
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
              Why Businesses Hire on FlowSmartly
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Get professional marketing management with built-in quality
              guarantees and full transparency.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {clientBenefits.map((benefit) => (
              <motion.div
                key={benefit.title}
                variants={fadeUp}
                className="group p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow"
              >
                <benefit.icon
                  className={`w-8 h-8 ${benefit.color} mb-4 group-hover:scale-110 transition-transform`}
                />
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ G. Revenue Model ═══ */}
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
              Transparent Pricing
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Simple, fair pricing for everyone. No hidden fees, no surprises.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Revenue split illustration */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <RevenueSplitPreview />
            </motion.div>

            {/* Pricing details */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="space-y-6"
            >
              <motion.div
                variants={fadeUp}
                className="p-6 rounded-xl border bg-card"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-accent-purple" />
                  </div>
                  <h3 className="font-semibold">For Agents</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keep <span className="font-semibold text-foreground">80%</span> of
                  every dollar. FlowSmartly takes a 20% platform fee that covers
                  payment processing, tools, hosting, and marketplace access.
                  Minimum client pricing: $100/month.
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="p-6 rounded-xl border bg-card"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className="font-semibold">For Clients</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pay your agent directly.{" "}
                  <span className="font-semibold text-foreground">
                    Your FlowSmartly subscription is waived
                  </span>{" "}
                  while you have an active agent relationship. One bill, zero
                  overlap.
                </p>
              </motion.div>

              <motion.div variants={fadeUp}>
                <p className="text-xs text-muted-foreground text-center">
                  No hidden fees. No long-term contracts. Cancel anytime.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ H. Featured Agents ═══ */}
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
              Featured Agents
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Top-performing professionals ready to grow your business.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {featuredAgents.map((agent) => (
              <motion.div
                key={agent.name}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="p-6 rounded-xl bg-card border hover:shadow-xl transition-shadow"
              >
                {/* Avatar + badge */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`w-14 h-14 rounded-full bg-gradient-to-br ${agent.gradient} flex items-center justify-center`}
                  >
                    <span className="text-white text-lg font-bold">
                      {agent.initials}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold">{agent.name}</h3>
                      <ShieldCheck className="w-4 h-4 text-brand-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {agent.specialty}
                    </p>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= Math.floor(agent.rating)
                            ? "text-amber-400 fill-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{agent.rating}</span>
                  <span className="text-xs text-muted-foreground">
                    ({agent.reviews} reviews)
                  </span>
                </div>

                {/* Industries */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agent.industries.map((ind) => (
                    <span
                      key={ind}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      <MapPin className="w-3 h-3" />
                      {ind}
                    </span>
                  ))}
                </div>

                {/* Price + CTA */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Starting at
                    </span>
                    <div className="text-xl font-bold text-accent-purple">
                      ${agent.price}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/register">View Profile</Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            More agents joining every day.{" "}
            <Link
              href="/register?redirect=/agent/apply"
              className="text-accent-purple hover:underline font-medium"
            >
              Apply to become an agent
            </Link>
          </motion.p>
        </div>
      </section>

      {/* ═══ I. Accountability System ═══ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-3xl mx-auto">
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
              Built-In Accountability
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Every agent is monitored with real performance data. No excuses,
              no guesswork — just results.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="relative"
          >
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border hidden sm:block" />

            <div className="space-y-8">
              {timelineSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  className="relative flex gap-4 sm:gap-6"
                >
                  {/* Icon circle */}
                  <div
                    className={`relative z-10 w-12 h-12 rounded-full ${step.bg} border-2 ${step.border} flex items-center justify-center flex-shrink-0`}
                  >
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ J. Testimonials ═══ */}
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
              What Our Users Say
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Hear from agents and clients who are growing together on
              FlowSmartly.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                className="p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow"
              >
                <Quote className="w-8 h-8 text-accent-purple/20 mb-4" />
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center`}
                  >
                    <span className="text-white text-xs font-bold">
                      {t.initials}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.role}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ K. Final CTA ═══ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-br from-accent-purple/10 via-brand-500/10 to-accent-teal/10 border">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Whether you&apos;re looking for expert help or ready to offer your
                skills — FlowSmartly&apos;s Agent Marketplace has you covered.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Find an Agent
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/register?redirect=/agent/apply">Become an Agent</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                No credit card required to get started.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
