import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  Gift,
  Megaphone,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
};

const earnSteps: Feature[] = [
  {
    icon: PlayCircle,
    title: "View approved content",
    description:
      "Watch sponsored clips, product demos, and partner posts that match your account rules.",
    color: "bg-sky-500",
  },
  {
    icon: Gift,
    title: "Earn credits instantly",
    description:
      "Qualified views add credits to your balance with clear limits, history, and daily progress.",
    color: "bg-amber-500",
  },
  {
    icon: Megaphone,
    title: "Spend on growth",
    description:
      "Use credits to boost posts, generate campaign creative, or test promotions without cash spend.",
    color: "bg-emerald-500",
  },
];

const spendOptions: Feature[] = [
  {
    icon: Sparkles,
    title: "AI content generation",
    description:
      "Turn earned credits into captions, ad concepts, email ideas, and ready-to-edit creative.",
    color: "bg-violet-500",
  },
  {
    icon: Target,
    title: "Campaign promotion",
    description:
      "Apply credits to targeted boosts when a product, offer, or local event needs more reach.",
    color: "bg-rose-500",
  },
  {
    icon: BarChart3,
    title: "Analytics unlocks",
    description:
      "Use credits for deeper reporting, trend checks, and recommendations before spending more.",
    color: "bg-sky-500",
  },
  {
    icon: RefreshCw,
    title: "Reusable growth loop",
    description:
      "Earning and spending live in the same workflow, so small wins keep moving back into marketing.",
    color: "bg-emerald-500",
  },
];

const guardrails = [
  "Daily earning caps keep the credit pool fair.",
  "Only qualified views and interactions count toward rewards.",
  "Clear activity history shows where credits came from and where they went.",
  "Business owners can choose when to spend credits or save them for a launch.",
];

function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function FeatureCard({ item }: { item: Feature }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
        <item.icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">{item.title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{item.description}</p>
    </div>
  );
}

function CreditSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-background/85 px-4 py-3 dark:bg-muted/30">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{value}</span>
    </div>
  );
}

export function ViewToEarnContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b bg-[linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,255,255,1))] px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-24 lg:px-8 dark:bg-[linear-gradient(180deg,rgba(32,22,8,0.72),rgba(9,9,11,1))]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm">
              <Gift className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              View-to-Earn Credits
            </div>
            <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Earn credits from attention and spend them on growth
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              FlowSmartly turns qualified content views into credits small
              businesses can use for AI creative, post boosts, and campaign tests
              before spending more cash.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-600" asChild>
                <Link href="/register">
                  Start earning credits
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="font-semibold" asChild>
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <div className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
              {[
                ["100", "daily earning target"],
                ["25+", "AI actions"],
                ["0", "card needed to start"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative min-h-[430px] overflow-visible sm:min-h-[560px]">
              <div className="absolute left-4 top-4 z-10 rounded-lg border bg-card/90 px-4 py-3 text-sm font-semibold shadow-sm">
                Credits ready to use
              </div>
              <Image
                src={illustrationImages.viewToEarnPageCreator}
                alt="Creator earning credits from content views and turning them into campaign boosts"
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                unoptimized
                className="object-contain object-center drop-shadow-[0_30px_70px_rgba(146,64,14,0.2)] dark:drop-shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
              />
              <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["View", "approved content"],
                  ["Earn", "instant credits"],
                  ["Boost", "growth actions"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-lg border bg-card/90 px-4 py-3 shadow-sm"
                  >
                    <div className="text-xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="How the loop works"
            title="A simple reward loop for businesses that need more reach"
            description="The story is easy to understand: view approved content, earn a usable balance, and convert that balance into growth actions."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {earnSteps.map((step) => (
              <FeatureCard key={step.title} item={step} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-zinc-950">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                  Credit command center
                </p>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Keep the earning math visible
                </h2>
              </div>
            </div>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Credits should feel useful, not mysterious. The page now explains
              where credits come from, how they are capped, and which actions
              they can fund.
            </p>
            <div className="mt-8 grid gap-3">
              <CreditSignal icon={Eye} label="Qualified views today" value="24" />
              <CreditSignal icon={Clock} label="Daily cap resets" value="8h" />
              <CreditSignal icon={CheckCircle2} label="Available balance" value="340 credits" />
              <CreditSignal icon={TrendingUp} label="Suggested next action" value="boost post" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {spendOptions.map((option) => (
              <FeatureCard key={option.title} item={option} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader
            align="left"
            eyebrow="Trust and guardrails"
            title="Rewards need rules people can understand"
            description="The system should look valuable without feeling vague or risky. These guardrails make the credit economy easier to trust."
          />
          <div className="grid gap-4">
            {guardrails.map((item) => (
              <div key={item} className="flex gap-4 rounded-lg border bg-card p-5 shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="leading-7 text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Why businesses care"
            title="Credits turn attention into action, not just points"
            description="Each benefit is tied back to a practical marketing outcome, so the feature feels like a growth tool instead of a gimmick."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Megaphone,
                title: "Test offers earlier",
                description:
                  "Earned credits let businesses put light promotion behind ideas before investing a larger budget.",
              },
              {
                icon: Sparkles,
                title: "Create more often",
                description:
                  "Credits can fund AI creative work so a thin content calendar does not stop momentum.",
              },
              {
                icon: ShieldCheck,
                title: "Stay in control",
                description:
                  "Owners can save, spend, and track credits from one workspace with clear status and usage history.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border bg-card p-6 shadow-sm">
                <item.icon className="h-8 w-8 text-amber-600 dark:text-amber-300" />
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-lg border bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(14,165,233,0.12),rgba(16,185,129,0.10))] p-8 text-center shadow-sm sm:p-12 dark:bg-card">
          <Zap className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-300" />
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Start earning credits before your next campaign needs a budget
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Create a free FlowSmartly account, earn from qualified engagement,
            and turn that balance into content, boosts, and campaign tests.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-600" asChild>
              <Link href="/register">
                Create free account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link href="/pricing">View plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
