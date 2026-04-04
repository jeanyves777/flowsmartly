import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Sparkles,
  Star,
  BarChart3,
  ArrowRight,
  Check,
  X,
  Zap,
  Shield,
  Eye,
  Users,
  RefreshCw,
  MessageSquare,
  TrendingUp,
  Globe,
  Search,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ListSmartly — AI-Powered Local Presence Management | FlowSmartly",
  description:
    "Sync your business listings across 150+ directories, manage reviews with AI, and dominate local search.",
};

const problems = [
  "Inconsistent listings across 50+ directories",
  "No time to manually update each one",
  "Duplicate listings hurt local SEO",
  "Bad reviews go unanswered",
];

const solutions = [
  "One dashboard syncs all 150+ directories",
  "AI autopilot monitors and fixes automatically",
  "Review command center with AI-drafted responses",
  "Citation score with actionable recommendations",
];

const coreFeatures = [
  {
    icon: RefreshCw,
    title: "Listing Sync Engine",
    description:
      "Push your accurate business info to 150+ directories in one click. Live status dashboard shows sync progress, errors, and confirmations in real time.",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    icon: Sparkles,
    title: "AI Autopilot",
    description:
      "Our AI monitors every listing for drift — wrong hours, outdated phone numbers, duplicate entries. It auto-corrects issues and suggests new directory submissions.",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: MessageSquare,
    title: "Review Command Center",
    description:
      "Aggregates reviews from Google, Yelp, Facebook, and more. AI drafts on-brand responses, flags negative sentiment, and tracks your reputation score over time.",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: BarChart3,
    title: "Presence Analytics",
    description:
      "Your citation score, local keyword tracking, and monthly AI-generated reports show exactly where you stand and what to improve next.",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    icon: Eye,
    title: "Competitor Tracking",
    description:
      "See how your local presence stacks up against competitors. Track their review counts, ratings, directory coverage, and find gaps to exploit.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Shield,
    title: "Manual Override",
    description:
      "Full control when you need it. Bulk update fields across all directories, view change history, and approve or reject AI suggestions before they go live.",
    gradient: "from-purple-500 to-pink-500",
  },
];

const tier1 = ["Google Business", "Yelp", "Apple Maps", "Bing Places", "BBB", "Facebook", "Foursquare", "TripAdvisor"];
const tier2 = ["YellowPages", "Manta", "Hotfrog", "Superpages", "CitySearch", "DexKnows", "MapQuest", "Waze"];
const tierRest = ["Angi", "Nextdoor", "Thumbtack", "Alignable", "Brownbook", "EZLocal", "USCity", "Judy\u2019s Book", "Local.com", "ShowMeLocal", "iBegin", "Tupalo", "Cylex", "n49", "Opendi", "Hub.biz"];

const steps = [
  {
    number: "01",
    title: "Enter Your Business Info",
    description: "Add your name, address, phone, hours, and categories once. We handle the rest.",
    icon: Globe,
  },
  {
    number: "02",
    title: "We Scan & Sync 150+ Directories",
    description: "ListSmartly scans for existing listings, fixes errors, and submits to new directories automatically.",
    icon: Search,
  },
  {
    number: "03",
    title: "AI Keeps Everything Perfect",
    description: "Our AI autopilot monitors your listings 24/7, fixes drift, responds to reviews, and reports back to you.",
    icon: Sparkles,
  },
];

const basicFeatures = [
  "Sync to 150+ directories",
  "AI autopilot monitoring",
  "Citation score dashboard",
  "Monthly AI reports",
  "Duplicate suppression",
  "Basic review monitoring",
  "Email support",
];

const proFeatures = [
  "Everything in Basic, plus:",
  "Review Command Center",
  "AI-drafted review responses",
  "Competitor tracking (5 competitors)",
  "Weekly AI reports",
  "Local keyword tracking",
  "Bulk update tools",
  "Priority support",
  "Change history & audit log",
];

export default function ListSmartlyDetailsPage() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl"
            style={{ animation: "float-orb 8s ease-in-out infinite" }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl"
            style={{ animation: "float-orb 10s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-teal-500/5 blur-3xl"
            style={{ animation: "float-orb 6s ease-in-out infinite 1s" }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-sm font-medium mb-6">
            <MapPin className="w-4 h-4" />
            ListSmartly
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Your{" "}
            <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
              AI-Powered
            </span>{" "}
            Local Presence Command Center
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Sync your business listings across 150+ directories, manage reviews with AI, and
            dominate local search — all from one dashboard.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-teal-500/25"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-accent transition-colors"
            >
              Sign In
            </Link>
          </div>

          {/* Trust metrics */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-500" />
              <span className="font-semibold text-foreground">150+ Directories</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-500" />
              <span className="font-semibold text-foreground">AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-foreground">$7/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Small Businesses Are{" "}
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                Invisible Online
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              If your listings are inconsistent, outdated, or missing, customers can&apos;t find you.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {problems.map((problem) => (
              <div
                key={problem}
                className="flex items-start gap-3 p-4 rounded-xl bg-card border border-red-200 dark:border-red-900/30"
              >
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5 text-red-500" />
                </div>
                <span className="text-sm text-foreground">{problem}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ListSmartly{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Fixes Everything
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              One platform to manage your entire local presence — powered by AI.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {solutions.map((solution) => (
              <div
                key={solution}
                className="flex items-start gap-3 p-4 rounded-xl bg-card border border-teal-200 dark:border-teal-900/30"
              >
                <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <span className="text-sm text-foreground">{solution}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features (6 blocks) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Own Local Search
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Six powerful tools working together to make your business impossible to miss.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreFeatures.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl bg-card border hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Directory Coverage */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              We Cover{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Every Directory
              </span>{" "}
              That Matters
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From the big players to niche industry directories, we have them all covered.
            </p>
          </div>

          {/* Tier 1 */}
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-3">Tier 1 — Essential</p>
            <div className="flex flex-wrap gap-2">
              {tier1.map((d) => (
                <span key={d} className="px-3 py-1.5 rounded-full text-sm font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Tier 2 */}
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-3">Tier 2 — Important</p>
            <div className="flex flex-wrap gap-2">
              {tier2.map((d) => (
                <span key={d} className="px-3 py-1.5 rounded-full text-sm font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Tier 3-7 */}
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">Tier 3-7 — Extended Coverage</p>
            <div className="flex flex-wrap gap-2">
              {tierRest.map((d) => (
                <span key={d} className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {d}
                </span>
              ))}
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                +125 more...
              </span>
            </div>
          </div>

          {/* Counter */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20">
              <Globe className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                161
              </span>
              <span className="text-sm font-medium text-muted-foreground">Directories Covered</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Two plans to fit your needs. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Plan */}
            <div className="rounded-2xl border-2 border-teal-500/20 bg-card p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-bold">
                14-DAY FREE TRIAL
              </div>

              <p className="text-muted-foreground mb-2 font-medium">ListSmartly Basic</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-5xl font-bold">$7</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-6">No credit card required</p>

              <ul className="space-y-3 mb-8">
                {basicFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block w-full text-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-teal-500/20"
              >
                Start Free Trial
              </Link>
              <p className="text-center text-xs text-muted-foreground mt-3">
                No card required. Cancel anytime.
              </p>
            </div>

            {/* Pro Plan */}
            <div className="rounded-2xl border-2 border-teal-500 bg-card p-8 relative overflow-hidden shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-teal-600 text-white text-xs font-bold">
                BEST VALUE
              </div>
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-bold">
                14-DAY FREE TRIAL
              </div>

              <p className="text-muted-foreground mb-2 font-medium mt-4">ListSmartly Pro</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold">$15</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                {proFeatures.map((feature, i) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className={`text-sm text-foreground ${i === 0 ? "font-semibold" : ""}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block w-full text-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-teal-500/25"
              >
                Start Free Trial
              </Link>
              <p className="text-center text-xs text-muted-foreground mt-3">
                No charge during trial. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Up and Running in{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                3 Simple Steps
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From invisible to everywhere in minutes. No technical skills required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 opacity-20" />

            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/20">
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm font-bold text-teal-500 mb-2 block">
                  STEP {step.number}
                </span>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-teal-600 to-cyan-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Be Found Everywhere?
          </h2>
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            Join thousands of businesses dominating local search with ListSmartly. Set up in
            minutes and let AI handle the rest.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-teal-600 font-bold hover:bg-white/90 transition-colors shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* CSS Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes float-orb {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-30px) scale(1.05); }
            }
          `,
        }}
      />
    </div>
  );
}
