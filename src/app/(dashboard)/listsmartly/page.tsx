"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Search,
  Sparkles,
  Check,
  ArrowRight,
  Star,
  Zap,
  Shield,
  RefreshCw,
  MessageSquare,
  BarChart3,
  Eye,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/shared/page-loader";
import { useToast } from "@/hooks/use-toast";

const FEATURES = [
  {
    icon: RefreshCw,
    label: "Listing Sync Engine",
    desc: "Sync across 150+ directories from one dashboard",
    color: "from-teal-500 to-teal-600",
  },
  {
    icon: Sparkles,
    label: "AI Autopilot",
    desc: "AI monitors and auto-fixes listing inconsistencies",
    color: "from-cyan-500 to-cyan-600",
  },
  {
    icon: MessageSquare,
    label: "Review Command Center",
    desc: "AI drafts review responses in your brand voice",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: BarChart3,
    label: "Citation Score",
    desc: "Real-time score tracking with actionable insights",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Eye,
    label: "Competitor Tracking",
    desc: "See how you rank vs local competitors",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: FileText,
    label: "Monthly AI Reports",
    desc: "Get automated presence reports delivered monthly",
    color: "from-purple-500 to-violet-600",
  },
];

const DIRECTORY_TIERS = [
  {
    tier: "Tier 1 — Critical",
    color: "from-teal-500 to-cyan-500",
    dirs: ["Google Business", "Yelp", "Apple Maps", "Bing Places", "Facebook"],
  },
  {
    tier: "Tier 2 — Major",
    color: "from-blue-500 to-indigo-500",
    dirs: ["YellowPages", "Manta", "Foursquare", "MapQuest", "TomTom"],
  },
  {
    tier: "Tier 3 — Supporting",
    color: "from-violet-500 to-purple-500",
    dirs: ["Hotfrog", "CitySearch", "MerchantCircle", "Local.com", "150+ more"],
  },
];

const BASIC_FEATURES = [
  "Manual listing management",
  "Consistency checking across directories",
  "Citation score tracking",
  "Basic analytics dashboard",
  "Email support",
];

const PRO_FEATURES = [
  "Everything in Basic",
  "AI Autopilot — auto-fix inconsistencies",
  "Review Command Center with AI responses",
  "Monthly AI presence reports",
  "Sentiment analysis on reviews",
  "Competitor tracking & benchmarking",
  "Priority support",
];

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    step: "1",
    title: "Enter your business info once",
    desc: "Add your name, address, phone, hours, and categories. We handle the rest.",
  },
  {
    icon: Search,
    step: "2",
    title: "We scan 150+ directories",
    desc: "Instantly discover where you're listed, missing, or inconsistent.",
  },
  {
    icon: Sparkles,
    step: "3",
    title: "AI keeps everything consistent",
    desc: "Autopilot monitors and fixes discrepancies automatically.",
  },
];

export default function ListSmartlyEntryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    checkProfile();
  }, []);

  async function checkProfile() {
    try {
      const res = await fetch("/api/listsmartly/profile");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const profile = json.data;
          const isSubscribed = ["active", "trialing", "free_trial"].includes(
            profile.subscriptionStatus
          );
          if (isSubscribed && profile.setupComplete) {
            router.replace("/listsmartly/dashboard");
            return;
          }
          if (isSubscribed && !profile.setupComplete) {
            router.replace("/listsmartly/onboarding");
            return;
          }
        }
      }
    } catch (error) {
      console.error("Failed to check profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(plan: "basic" | "pro") {
    setSelectedPlan(plan);
    setActivating(true);
    try {
      const res = await fetch("/api/listsmartly/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "ListSmartly activated!",
          description:
            plan === "basic"
              ? "Your 30-day free trial has started. Let's set up your business!"
              : "Your 14-day free trial has started. Let's set up your business!",
        });
        router.push("/listsmartly/onboarding");
      } else {
        toast({
          title: "Activation failed",
          description: json.error?.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Activation failed",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <PageLoader tips={["Loading ListSmartly..."]} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-20">
      {/* ── Hero Section ── */}
      <section className="relative text-center pt-8">
        {/* Animated background gradient */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>

        {/* Animated MapPin icon */}
        <div className="relative inline-flex mb-6">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-teal-500/30 animate-[float_3s_ease-in-out_infinite]">
            <MapPin className="h-12 w-12 text-white" />
          </div>
          {/* Orbiting dots */}
          <div className="absolute inset-0 animate-[spin_8s_linear_infinite]">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite_reverse]">
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="absolute inset-0 animate-[spin_10s_linear_infinite]">
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 h-2 w-2 rounded-full bg-pink-400" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
          ListSmartly
        </h1>
        <p className="mt-2 text-lg md:text-xl font-medium text-foreground/80">
          Your AI-Powered Local Presence Command Center
        </p>
        <p className="mt-3 text-base text-muted-foreground max-w-2xl mx-auto">
          Sync your business listings across 150+ directories, manage reviews
          with AI, and dominate local search — all from one dashboard.
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-teal-500" /> 150+ Directories
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-cyan-500" /> AI Autopilot
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-500" /> Review Management
          </span>
        </div>
      </section>

      {/* ── Dashboard Preview SVG ── */}
      <section className="relative">
        <div className="rounded-2xl border bg-card overflow-hidden shadow-xl">
          <svg
            viewBox="0 0 1200 600"
            className="w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="lsHeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="lsCardGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f0fdfa" />
                <stop offset="100%" stopColor="#ccfbf1" />
              </linearGradient>
              <linearGradient id="lsCardGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fefce8" />
                <stop offset="100%" stopColor="#fef9c3" />
              </linearGradient>
              <linearGradient id="lsCardGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef2f2" />
                <stop offset="100%" stopColor="#fecaca" />
              </linearGradient>
              <linearGradient id="lsBtnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="lsScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* Browser chrome */}
            <rect x="0" y="0" width="1200" height="600" rx="12" fill="#f8fafc" />
            <rect x="0" y="0" width="1200" height="40" rx="12" fill="#f1f5f9" />
            <rect x="0" y="28" width="1200" height="12" fill="#f1f5f9" />
            <circle cx="20" cy="18" r="6" fill="#ef4444" opacity="0.7" />
            <circle cx="40" cy="18" r="6" fill="#eab308" opacity="0.7" />
            <circle cx="60" cy="18" r="6" fill="#22c55e" opacity="0.7" />
            <rect x="300" y="10" width="600" height="20" rx="10" fill="#e2e8f0" />
            <text x="460" y="24" fontSize="10" fill="#94a3b8" fontFamily="system-ui">
              listsmartly.flowsmartly.com/dashboard
            </text>

            {/* Dashboard header */}
            <rect x="0" y="40" width="1200" height="60" fill="url(#lsHeaderGrad)" />
            <text x="40" y="77" fontSize="20" fill="white" fontWeight="bold" fontFamily="system-ui">
              ListSmartly Dashboard
            </text>
            {/* Search bar */}
            <rect x="400" y="55" width="400" height="30" rx="15" fill="rgba(255,255,255,0.2)" />
            <text x="425" y="75" fontSize="12" fill="rgba(255,255,255,0.6)" fontFamily="system-ui">
              Search directories...
            </text>

            {/* Citation Score gauge */}
            <rect x="40" y="120" width="300" height="220" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="65" y="150" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">
              Citation Score
            </text>
            {/* Gauge background */}
            <circle cx="190" cy="250" r="65" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            {/* Gauge fill — animates to 78% (circumference ~408, 78% ~318) */}
            <circle
              cx="190"
              cy="250"
              r="65"
              fill="none"
              stroke="url(#lsScoreGrad)"
              strokeWidth="10"
              strokeDasharray="318 408"
              strokeLinecap="round"
              transform="rotate(-90 190 250)"
            >
              <animate attributeName="stroke-dasharray" from="0 408" to="318 408" dur="1.5s" fill="freeze" />
            </circle>
            <text x="170" y="258" fontSize="32" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">
              78
            </text>
            <text x="165" y="280" fontSize="12" fill="#6b7280" fontFamily="system-ui">
              out of 100
            </text>

            {/* Listing cards */}
            {/* Google — Live */}
            <rect x="370" y="120" width="490" height="65" rx="10" fill="url(#lsCardGrad1)" stroke="#99f6e4" strokeWidth="1">
              <animate attributeName="y" values="120;117;120" dur="3s" repeatCount="indefinite" />
            </rect>
            <circle cx="400" cy="152" r="16" fill="#14b8a6" opacity="0.15" />
            <text x="393" y="157" fontSize="14" fill="#0d9488" fontWeight="bold" fontFamily="system-ui">G</text>
            <text x="425" y="148" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Google Business</text>
            <text x="425" y="168" fontSize="11" fill="#6b7280" fontFamily="system-ui">Name, address, phone verified</text>
            <rect x="760" y="140" width="80" height="24" rx="12" fill="#dcfce7" />
            <text x="775" y="156" fontSize="11" fill="#16a34a" fontWeight="600" fontFamily="system-ui">Live</text>

            {/* Yelp — Needs Update */}
            <rect x="370" y="200" width="490" height="65" rx="10" fill="url(#lsCardGrad2)" stroke="#fde68a" strokeWidth="1">
              <animate attributeName="y" values="200;197;200" dur="3s" begin="0.5s" repeatCount="indefinite" />
            </rect>
            <circle cx="400" cy="232" r="16" fill="#eab308" opacity="0.15" />
            <text x="394" y="237" fontSize="14" fill="#ca8a04" fontWeight="bold" fontFamily="system-ui">Y</text>
            <text x="425" y="228" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Yelp</text>
            <text x="425" y="248" fontSize="11" fill="#6b7280" fontFamily="system-ui">Phone number mismatch detected</text>
            <rect x="730" y="220" width="110" height="24" rx="12" fill="#fef9c3" />
            <text x="740" y="236" fontSize="11" fill="#ca8a04" fontWeight="600" fontFamily="system-ui">Needs Update</text>

            {/* Apple Maps — Missing */}
            <rect x="370" y="280" width="490" height="65" rx="10" fill="url(#lsCardGrad3)" stroke="#fecaca" strokeWidth="1">
              <animate attributeName="y" values="280;277;280" dur="3s" begin="1s" repeatCount="indefinite" />
            </rect>
            <circle cx="400" cy="312" r="16" fill="#ef4444" opacity="0.15" />
            <text x="393" y="317" fontSize="14" fill="#dc2626" fontWeight="bold" fontFamily="system-ui">A</text>
            <text x="425" y="308" fontSize="14" fill="#1e293b" fontWeight="600" fontFamily="system-ui">Apple Maps</text>
            <text x="425" y="328" fontSize="11" fill="#6b7280" fontFamily="system-ui">No listing found in directory</text>
            <rect x="750" y="300" width="90" height="24" rx="12" fill="#fee2e2" />
            <text x="765" y="316" fontSize="11" fill="#dc2626" fontWeight="600" fontFamily="system-ui">Missing</text>

            {/* Stats sidebar */}
            <rect x="900" y="120" width="260" height="95" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="925" y="150" fontSize="12" fill="#6b7280" fontFamily="system-ui">Live Listings</text>
            <text x="925" y="180" fontSize="28" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">42</text>
            <text x="985" y="180" fontSize="12" fill="#22c55e" fontWeight="600" fontFamily="system-ui">of 150+</text>
            {/* Mini bar */}
            <rect x="925" y="195" width="210" height="6" rx="3" fill="#e2e8f0" />
            <rect x="925" y="195" width="0" height="6" rx="3" fill="#14b8a6">
              <animate attributeName="width" from="0" to="58" dur="1s" fill="freeze" />
            </rect>

            <rect x="900" y="230" width="125" height="115" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="920" y="260" fontSize="12" fill="#6b7280" fontFamily="system-ui">Missing</text>
            <text x="920" y="293" fontSize="28" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">12</text>
            <text x="920" y="318" fontSize="11" fill="#ef4444" fontFamily="system-ui">directories</text>

            <rect x="1035" y="230" width="125" height="115" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="1055" y="260" fontSize="12" fill="#6b7280" fontFamily="system-ui">Avg Rating</text>
            <text x="1055" y="293" fontSize="28" fill="#1e293b" fontWeight="bold" fontFamily="system-ui">4.8</text>
            <text x="1055" y="318" fontSize="14" fill="#eab308" fontFamily="system-ui">
              ★★★★★
            </text>

            {/* Animated sparkle */}
            <g transform="translate(850, 152)">
              <path d="M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z" fill="#14b8a6">
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite" />
              </path>
            </g>
          </svg>
        </div>
      </section>

      {/* ── Problem → Solution Section ── */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">Why ListSmartly?</h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Most businesses are invisible online. We fix that.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* The Problem */}
          <div className="rounded-2xl border-2 border-red-200 dark:border-red-900/40 bg-card p-6 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                The Problem
              </h3>
            </div>
            <p className="text-sm font-medium mb-4 text-foreground/80">
              Your business is invisible online
            </p>
            <div className="space-y-3">
              {[
                "Inconsistent listings confuse search engines",
                "Outdated info drives customers away",
                "Duplicate listings hurt your rankings",
                "Unanswered reviews damage your reputation",
              ].map((point) => (
                <div key={point} className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The Solution */}
          <div className="rounded-2xl border-2 border-teal-200 dark:border-teal-900/40 bg-card p-6 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-teal-500" />
              </div>
              <h3 className="text-lg font-bold text-teal-600 dark:text-teal-400">
                The Solution
              </h3>
            </div>
            <p className="text-sm font-medium mb-4 text-foreground/80">
              ListSmartly fixes everything
            </p>
            <div className="space-y-3">
              {[
                "One-click sync across 150+ directories",
                "AI Autopilot monitors and auto-fixes issues",
                "Review Command Center with AI responses",
                "Citation scoring with actionable insights",
              ].map((point) => (
                <div key={point} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">
            Everything you need to dominate local search
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            From listing sync to AI-powered review management — ListSmartly
            gives you the tools to own your local presence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.label}
              className="group relative rounded-2xl border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Gradient accent */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity`}
              />

              <div
                className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}
              >
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{feature.label}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Directory Tiers Showcase ── */}
      <section className="rounded-2xl border bg-gradient-to-r from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-950/30 dark:via-cyan-950/30 dark:to-blue-950/30 p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">
            We cover ALL the directories that matter
          </h2>
          <p className="text-muted-foreground mt-2">
            150+ directories organized by impact on your local search ranking
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {DIRECTORY_TIERS.map((tier, i) => (
            <div
              key={tier.tier}
              className="rounded-xl bg-card border p-5 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r ${tier.color} text-white text-xs font-semibold mb-4`}
              >
                {tier.tier}
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.dirs.map((dir) => (
                  <span
                    key={dir}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted text-xs font-medium"
                  >
                    {dir}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Plans ── */}
      <section id="pricing">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold">Choose Your Plan</h2>
          <p className="text-muted-foreground mt-2">
            Start free. Choose the plan that fits your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Basic Plan */}
          <div className="rounded-2xl border-2 border-border bg-card shadow-lg overflow-hidden hover:border-teal-300 transition-colors">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-5 text-center text-white">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <h3 className="text-xl font-bold">Basic</h3>
              <p className="text-white/70 text-xs mt-1">
                Everything you need to manage your listings
              </p>
            </div>

            <div className="p-6">
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-3">
                  30-Day Free Trial
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold">$7</span>
                  <span className="text-muted-foreground text-lg">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  After trial ends. Cancel anytime.
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  No credit card required
                </p>
              </div>

              <div className="space-y-2.5 mb-6">
                {BASIC_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleActivate("basic")}
                disabled={activating}
                variant="outline"
                className="w-full h-11 text-base"
                size="lg"
              >
                {activating && selectedPlan === "basic"
                  ? "Activating..."
                  : "Start Free Trial"}
                {!(activating && selectedPlan === "basic") && (
                  <ArrowRight className="h-4 w-4 ml-2" />
                )}
              </Button>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="relative rounded-2xl border-2 border-teal-400 dark:border-teal-600 bg-card shadow-xl overflow-hidden">
            {/* Best value badge */}
            <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-semibold shadow-md">
              <Star className="h-3 w-3" />
              BEST VALUE
            </div>

            <div className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 px-6 py-5 text-center text-white">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <h3 className="text-xl font-bold">Pro</h3>
              <p className="text-white/80 text-xs mt-1">
                Grow faster with AI-powered features
              </p>
            </div>

            <div className="p-6">
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-3">
                  14-Day Free Trial
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold">$15</span>
                  <span className="text-muted-foreground text-lg">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  After trial ends. Cancel anytime.
                </p>
              </div>

              <div className="space-y-2.5 mb-6">
                {PRO_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleActivate("pro")}
                disabled={activating}
                className="w-full h-11 text-base bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-lg shadow-teal-500/25"
                size="lg"
              >
                {activating && selectedPlan === "pro"
                  ? "Activating..."
                  : "Start Free Trial"}
                {!(activating && selectedPlan === "pro") && (
                  <ArrowRight className="h-4 w-4 ml-2" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Basic: 30-day trial, no card required. Pro: 14-day trial, card
          required.
        </p>
      </section>

      {/* ── How It Works ── */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">How It Works</h2>
          <p className="text-muted-foreground mt-2">
            Three simple steps to local search domination
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.step}
              className="relative rounded-2xl border bg-card p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              {/* Step number */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-bold flex items-center justify-center shadow-md">
                {step.step}
              </div>

              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 flex items-center justify-center mx-auto mb-4 mt-2">
                <step.icon className="h-7 w-7 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-base mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>

              {/* Connector arrow (except last) */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2">
                  <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="text-center">
        <h2 className="text-2xl font-bold mb-3">
          Ready to dominate local search?
        </h2>
        <p className="text-muted-foreground mb-6">
          Join ListSmartly and take control of your local presence today.
        </p>
        <Button
          onClick={() =>
            document
              .getElementById("pricing")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          size="lg"
          className="h-12 px-8 text-base bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-lg shadow-teal-500/25"
        >
          Get Started Free
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </section>

      {/* Float animation keyframe */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}
