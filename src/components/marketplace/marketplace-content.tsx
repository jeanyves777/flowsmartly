import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Gift,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

type IconCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
};

const clientSteps: IconCard[] = [
  {
    icon: Search,
    title: "Search by specialty",
    description:
      "Filter agents by channel, industry, budget, language, and the type of growth work you need done.",
    color: "bg-sky-500",
  },
  {
    icon: ShieldCheck,
    title: "Review proof",
    description:
      "Compare verified profiles, ratings, sample work, and performance signals before you invite anyone in.",
    color: "bg-violet-500",
  },
  {
    icon: Handshake,
    title: "Hire with control",
    description:
      "Bring an agent into your FlowSmartly workspace with clear permissions, milestones, and approvals.",
    color: "bg-emerald-500",
  },
  {
    icon: BarChart3,
    title: "Measure the work",
    description:
      "Track delivery, response time, content quality, and campaign impact from the same command center.",
    color: "bg-amber-500",
  },
];

const agentSteps: IconCard[] = [
  {
    icon: ClipboardCheck,
    title: "Apply and verify",
    description:
      "Create your agent profile, submit proof of work, and pass FlowSmartly quality review.",
    color: "bg-sky-500",
  },
  {
    icon: LayoutDashboard,
    title: "Package your services",
    description:
      "Define your offers, preferred clients, delivery cadence, and the platform workflows you manage.",
    color: "bg-violet-500",
  },
  {
    icon: Users,
    title: "Run client accounts",
    description:
      "Use FlowSmartly tools for planning, publishing, messaging, local listings, and reporting.",
    color: "bg-emerald-500",
  },
  {
    icon: CircleDollarSign,
    title: "Earn recurring revenue",
    description:
      "Keep a clear share of client revenue while your reputation grows with reviews and delivery scores.",
    color: "bg-rose-500",
  },
];

const proofStats = [
  { value: "80%", label: "agent revenue share" },
  { value: "$100+", label: "minimum monthly offer" },
  { value: "AI", label: "delivery scoring" },
];

const featuredProfiles = [
  {
    initials: "SM",
    name: "Sarah Mitchell",
    specialty: "Social media and content systems",
    price: "$250/mo",
    rating: "4.9",
    fit: "Ecommerce, beauty, creator brands",
    accent: "from-violet-500 to-sky-500",
  },
  {
    initials: "JC",
    name: "James Chen",
    specialty: "Local growth and review operations",
    price: "$350/mo",
    rating: "4.8",
    fit: "Restaurants, clinics, service businesses",
    accent: "from-emerald-500 to-cyan-500",
  },
  {
    initials: "MG",
    name: "Maria Gonzalez",
    specialty: "Paid ads and launch campaigns",
    price: "$500/mo",
    rating: "5.0",
    fit: "Real estate, finance, coaching",
    accent: "from-amber-500 to-rose-500",
  },
];

const accountability = [
  {
    title: "Weekly delivery signal",
    description:
      "The workspace shows what shipped, what is waiting on approval, and where a client needs attention.",
  },
  {
    title: "Quality review trail",
    description:
      "Campaign work is scored against the brief, brand voice, deadlines, and channel requirements.",
  },
  {
    title: "Easy agent changes",
    description:
      "If the relationship is not working, clients can compare alternatives and move without rebuilding the account.",
  },
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
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({ item, index }: { item: IconCard; index: number }) {
  return (
    <div className="relative rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
          <item.icon className="h-6 w-6 text-white" />
        </div>
        <span className="rounded-full border bg-background px-3 py-1 text-sm font-semibold text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{item.description}</p>
    </div>
  );
}

function SignalRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-background/80 px-4 py-3 dark:bg-muted/30">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{value}</span>
    </div>
  );
}

export function MarketplaceContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b bg-[linear-gradient(180deg,rgba(240,249,255,0.88),rgba(255,255,255,1))] px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-24 lg:px-8 dark:bg-[linear-gradient(180deg,rgba(12,18,32,1),rgba(9,9,11,1))]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm">
              <Briefcase className="h-4 w-4 text-sky-600 dark:text-sky-300" />
              Agent Marketplace
            </div>
            <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Hire vetted agents and keep the work visible
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              FlowSmartly connects businesses with verified marketers who can run
              content, social, ads, local listings, and reporting directly inside
              the same workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-sky-600 font-semibold text-white hover:bg-sky-700" asChild>
                <Link href="/register">
                  Find an agent
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="font-semibold" asChild>
                <Link href="/register?redirect=/agent/apply">Become an agent</Link>
              </Button>
            </div>
            <div className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
              {proofStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative min-h-[440px] overflow-visible sm:min-h-[560px]">
              <div className="absolute left-4 top-4 z-10 rounded-lg border bg-card/90 px-4 py-3 text-sm font-semibold shadow-sm">
                Vetted agent match
              </div>
              <Image
                src={illustrationImages.marketplacePageAgent}
                alt="Marketing consultant with agent matching and campaign analytics cards"
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                unoptimized
                className="object-contain object-center drop-shadow-[0_30px_70px_rgba(15,23,42,0.2)] dark:drop-shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
              />
              <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["97%", "profile fit"],
                  ["12h", "avg response"],
                  ["4.9", "client rating"],
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

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="For businesses"
            title="Find an expert without turning marketing into a guessing game"
            description="The marketplace is designed around trust: proof of work, permissioned collaboration, and real delivery signals after the hire."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {clientSteps.map((step, index) => (
              <StepCard key={step.title} item={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="for-agents" className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader
            align="left"
            eyebrow="For agents"
            title="Build a recurring service business on top of FlowSmartly"
            description="Agents get the marketplace profile, client workspace, AI-assisted campaign tools, and quality signals needed to sell professional marketing work with confidence."
          />
          <div className="grid gap-5 md:grid-cols-2">
            {agentSteps.map((step, index) => (
              <StepCard key={step.title} item={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.88fr] lg:items-center">
          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500 text-white">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                  Shared workflow
                </p>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  One workspace for agent, client, and approvals
                </h2>
              </div>
            </div>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
              Businesses keep visibility while agents get the tools to plan,
              create, publish, and report. The relationship feels managed, not
              outsourced into a black box.
            </p>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              <SignalRow icon={MessageSquare} label="Client brief" value="ready" />
              <SignalRow icon={Sparkles} label="Campaign draft" value="AI assisted" />
              <SignalRow icon={CheckCircle2} label="Approval queue" value="3 pending" />
              <SignalRow icon={Zap} label="Launch readiness" value="94%" />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                  Revenue model
                </p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight">
                  Simple economics for both sides
                </h3>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <Wallet className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="rounded-lg border bg-background p-5 dark:bg-muted/30">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  For clients
                </div>
                <p className="mt-2 leading-7 text-muted-foreground">
                  FlowSmartly subscription fees can be waived while an approved
                  agent manages the account, so the budget goes toward active work.
                </p>
              </div>
              <div className="rounded-lg border bg-background p-5 dark:bg-muted/30">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <CircleDollarSign className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  For agents
                </div>
                <p className="mt-2 leading-7 text-muted-foreground">
                  Agents define offers, manage delivery, and earn recurring
                  revenue with transparent platform fees and payout reporting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Marketplace profiles"
            title="Profiles are built for comparison, not guesswork"
            description="Featured profile cards show the information buyers actually need before starting a managed marketing relationship."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {featuredProfiles.map((profile) => (
              <div key={profile.name} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className={`h-2 bg-gradient-to-r ${profile.accent}`} />
                <div className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${profile.accent} text-lg font-bold text-white`}>
                      {profile.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{profile.name}</h3>
                        <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.specialty}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <Star key={item} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-sm font-semibold">{profile.rating}</span>
                  </div>
                  <div className="mt-5 rounded-lg border bg-background p-4 dark:bg-muted/30">
                    <p className="text-sm font-semibold text-muted-foreground">Best fit</p>
                    <p className="mt-1 leading-7">{profile.fit}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t pt-5">
                    <div>
                      <p className="text-xs text-muted-foreground">Starting at</p>
                      <p className="text-xl font-bold">{profile.price}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/register">View profile</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader
            align="left"
            eyebrow="Accountability"
            title="Built-in signals keep every relationship honest"
            description="The page needs to sell trust. These checks make it clear that FlowSmartly is not just a directory, it is the system where work gets measured."
          />
          <div className="space-y-4">
            {accountability.map((item, index) => (
              <div key={item.title} className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 font-bold text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                    <p className="mt-2 leading-7 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-lg border bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(16,185,129,0.12),rgba(139,92,246,0.10))] p-8 text-center shadow-sm sm:p-12 dark:bg-card">
          <Target className="mx-auto h-10 w-10 text-sky-600 dark:text-sky-300" />
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Start with the right expert, then keep all the work visible
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Businesses can hire help. Agents can build recurring packages. Both
            sides work from one FlowSmartly growth workspace.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="bg-sky-600 font-semibold text-white hover:bg-sky-700" asChild>
              <Link href="/register">
                Browse agents
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link href="/register?redirect=/agent/apply">Apply as agent</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
