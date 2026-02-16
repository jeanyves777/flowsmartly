"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Star,
  Search,
  TrendingUp,
  ShieldCheck,
  Briefcase,
  Users,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Animated Agent Card ─────────────────────────────────────────
function AgentCard({
  name,
  specialty,
  rating,
  clients,
  score,
  avatar,
  delay,
}: {
  name: string;
  specialty: string;
  rating: number;
  clients: number;
  score: number;
  avatar: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      className="group relative bg-card border rounded-2xl p-5 hover:shadow-xl hover:border-brand-500/30 transition-all duration-500 hover:-translate-y-1"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 to-accent-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        {/* Avatar + Info */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-white font-bold text-lg shrink-0">
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">{name}</div>
            <div className="text-xs text-muted-foreground">{specialty}</div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium">{rating}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
            <div className="text-sm font-bold text-foreground">{clients}</div>
            <div className="text-[10px] text-muted-foreground">Active Clients</div>
          </div>
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
            <div className="text-sm font-bold text-brand-500">{score}%</div>
            <div className="text-[10px] text-muted-foreground">Performance</div>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5">
          {["Content", "Strategy", "Analytics"].map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 text-[10px] font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Animated Process Step ───────────────────────────────────────
function ProcessStep({
  icon: Icon,
  title,
  description,
  number,
  delay,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  number: number;
  delay: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      viewport={{ once: true }}
      className="flex items-start gap-4"
    >
      <div className="relative shrink-0">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-brand-500 flex items-center justify-center">
          <span className="text-[9px] font-bold text-brand-500">{number}</span>
        </div>
      </div>
      <div>
        <div className="font-semibold text-foreground mb-1">{title}</div>
        <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
      </div>
    </motion.div>
  );
}

// ─── Floating Icons Background ───────────────────────────────────
function FloatingIcons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { icon: Star, x: "10%", y: "15%", size: 20, delay: 0, duration: 6 },
        { icon: Briefcase, x: "85%", y: "20%", size: 24, delay: 1, duration: 7 },
        { icon: TrendingUp, x: "75%", y: "75%", size: 18, delay: 2, duration: 5 },
        { icon: ShieldCheck, x: "15%", y: "80%", size: 22, delay: 0.5, duration: 8 },
        { icon: Sparkles, x: "50%", y: "10%", size: 16, delay: 1.5, duration: 6.5 },
        { icon: CheckCircle2, x: "90%", y: "50%", size: 20, delay: 3, duration: 7 },
      ].map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-brand-500/10"
          style={{ left: item.x, top: item.y }}
          animate={{
            y: [0, -15, 0],
            rotate: [0, 5, -5, 0],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <item.icon style={{ width: item.size, height: item.size }} />
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SECTION
// ═══════════════════════════════════════════════════════════════════
export function MarketplaceSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const agents = [
    { name: "Sarah Mitchell", specialty: "Social Media & Content", rating: 4.9, clients: 12, score: 96, avatar: "SM" },
    { name: "Alex Rivera", specialty: "E-Commerce Growth", rating: 4.8, clients: 8, score: 92, avatar: "AR" },
    { name: "Jordan Lee", specialty: "Brand Strategy & Ads", rating: 4.9, clients: 15, score: 98, avatar: "JL" },
  ];

  const steps = [
    {
      icon: Search,
      title: "Browse & Discover",
      description: "Search verified agents by specialty, industry, and budget. Compare performance scores and reviews.",
      color: "bg-brand-500",
    },
    {
      icon: Users,
      title: "Hire Seamlessly",
      description: "Choose your agent and onboard instantly. Your subscription fee is waived while they manage your account.",
      color: "bg-accent-purple",
    },
    {
      icon: BarChart3,
      title: "Track Performance",
      description: "AI-powered strategy scoring monitors your agent's work. Real-time dashboards keep you in control.",
      color: "bg-emerald-500",
    },
    {
      icon: Zap,
      title: "Grow Faster",
      description: "Expert agents execute your strategy daily — content, campaigns, analytics — so you can focus on your business.",
      color: "bg-amber-500",
    },
  ];

  return (
    <section ref={sectionRef} className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <FloatingIcons />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-purple/10 text-accent-purple text-sm font-medium mb-4"
          >
            <Briefcase className="w-4 h-4" />
            Agent Marketplace
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Hire Expert Agents to{" "}
            <span className="bg-gradient-to-r from-brand-500 via-accent-purple to-brand-500 bg-clip-text text-transparent">
              Grow Your Brand
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect with vetted social media professionals who manage your
            account, execute strategies, and deliver measurable results.
          </p>
        </motion.div>

        {/* Two-column: Agent cards + Process */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Agent showcase cards */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex items-center gap-2 mb-6"
            >
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-semibold text-foreground">Top-Rated Agents</span>
            </motion.div>

            <div className="grid gap-4">
              {agents.map((agent, i) => (
                <AgentCard key={agent.name} {...agent} delay={0.2 + i * 0.15} />
              ))}
            </div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="flex flex-wrap items-center justify-center gap-4 mt-6"
            >
              {[
                { icon: ShieldCheck, label: "Verified Agents" },
                { icon: TrendingUp, label: "Performance Tracked" },
                { icon: Sparkles, label: "AI-Powered Scoring" },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <badge.icon className="w-3.5 h-3.5 text-brand-500" />
                  {badge.label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: How it works process */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex items-center gap-2 mb-6"
            >
              <Zap className="w-5 h-5 text-brand-500" />
              <span className="text-sm font-semibold text-foreground">How It Works</span>
            </motion.div>

            <div className="space-y-6">
              {steps.map((step, i) => (
                <ProcessStep key={step.title} {...step} number={i + 1} delay={0.3 + i * 0.15} />
              ))}
            </div>

            {/* Connector line */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={isInView ? { scaleY: 1 } : {}}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
              className="absolute left-6 top-0 w-[2px] h-full bg-gradient-to-b from-brand-500/20 via-accent-purple/20 to-emerald-500/20 origin-top hidden lg:block"
              style={{ left: "calc(50% + 1.5rem + 24px)" }}
            />

            {/* CTA Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-brand-500/10 via-accent-purple/10 to-transparent border border-brand-500/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Ready to delegate?</div>
                  <div className="text-xs text-muted-foreground">
                    Browse verified agents and find your perfect match
                  </div>
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href="/marketplace">
                  Explore the Marketplace
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
