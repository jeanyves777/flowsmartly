import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Ban,
  Bell,
  CheckCircle2,
  Eye,
  FileCheck2,
  Lock,
  Mail,
  MessageSquare,
  PhoneOff,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

export const metadata: Metadata = {
  title: "Marketing Compliance",
  description:
    "FlowSmartly marketing compliance tools for consent-first SMS, email opt-ins, audit trails, and unsubscribe controls.",
};

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
};

const channelFlows = [
  {
    title: "SMS consent flow",
    description:
      "Customers see clear opt-in language, provide a phone number, and receive compliant HELP and STOP instructions.",
    icon: MessageSquare,
    items: ["Explicit consent", "Frequency disclosure", "STOP keyword handling"],
  },
  {
    title: "Email consent flow",
    description:
      "Subscribers can confirm preferences, manage topics, and unsubscribe without friction from every campaign.",
    icon: Mail,
    items: ["Clear sender identity", "Preference center", "Unsubscribe links"],
  },
];

const complianceFeatures: Feature[] = [
  {
    icon: UserCheck,
    title: "Consent collection",
    description:
      "Capture affirmative opt-ins with the exact disclosure shown at signup.",
    color: "bg-emerald-500",
  },
  {
    icon: FileCheck2,
    title: "Audit trail",
    description:
      "Keep timestamps, source, campaign, and consent status available for review.",
    color: "bg-sky-500",
  },
  {
    icon: Ban,
    title: "Instant opt-out",
    description:
      "Process STOP replies and unsubscribe requests quickly across future sends.",
    color: "bg-rose-500",
  },
  {
    icon: Lock,
    title: "Suppression protection",
    description:
      "Block opted-out contacts across campaigns so teams do not message them by accident.",
    color: "bg-violet-500",
  },
  {
    icon: Eye,
    title: "Policy visibility",
    description:
      "Keep privacy and SMS terms easy to find from forms, messages, and account flows.",
    color: "bg-amber-500",
  },
  {
    icon: Bell,
    title: "Send safeguards",
    description:
      "Use quiet hours, frequency controls, and review signals before campaigns launch.",
    color: "bg-teal-500",
  },
];

const regulations = [
  {
    title: "TCPA",
    description:
      "Prior express written consent, message frequency disclosure, and clear opt-out instructions for SMS marketing.",
  },
  {
    title: "CAN-SPAM",
    description:
      "Accurate sender information, truthful messaging, physical address, and unsubscribe controls for email.",
  },
  {
    title: "CTIA",
    description:
      "Carrier-friendly SMS practices including HELP/STOP keywords, confirmation messages, and compliant content.",
  },
];

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
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
      <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{item.description}</p>
    </div>
  );
}

export default function MarketingCompliancePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,1))] px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-24 lg:px-8 dark:bg-[linear-gradient(180deg,rgba(10,28,21,0.8),rgba(9,9,11,1))]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              TCPA and CAN-SPAM ready
            </div>
            <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Consent-first marketing built into every campaign
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              FlowSmartly helps teams collect permission, respect opt-outs, and
              keep the audit trail visible across SMS and email marketing.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700" asChild>
                <Link href="/register">
                  Get started free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="font-semibold" asChild>
                <Link href="/privacy">Read privacy policy</Link>
              </Button>
            </div>
            <div className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
              {[
                ["STOP", "instant SMS opt-out"],
                ["Audit", "consent records"],
                ["Policy", "clear disclosures"],
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
                Consent workflow approved
              </div>
              <Image
                src={illustrationImages.compliancePageAdvisor}
                alt="Compliance advisor reviewing SMS, email, privacy, opt-out, and audit workflow cards"
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                unoptimized
                className="object-contain object-center drop-shadow-[0_30px_70px_rgba(20,83,45,0.2)] dark:drop-shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
              />
              <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["Opt-in", "clear permission"],
                  ["Audit", "records saved"],
                  ["Opt-out", "suppression active"],
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
            eyebrow="Consent flows"
            title="Make permission easy to understand before messages go out"
            description="The public page now explains the customer experience in plain language instead of relying on dense legal framing."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {channelFlows.map((flow) => (
              <div key={flow.title} className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                    <flow.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">{flow.title}</h3>
                    <p className="mt-3 leading-7 text-muted-foreground">{flow.description}</p>
                  </div>
                </div>
                <div className="mt-8 grid gap-3">
                  {flow.items.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 dark:bg-muted/30">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Lifecycle"
            title="From opt-in to opt-out, every step is trackable"
            description="Compliance is strongest when operators can see each step and customers can leave without friction."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {[
              { icon: UserCheck, title: "Collect consent", text: "Capture source, timestamp, and disclosure." },
              { icon: MessageSquare, title: "Send with rules", text: "Respect quiet hours and message limits." },
              { icon: Eye, title: "Monitor status", text: "Track delivery, failures, and customer preferences." },
              { icon: PhoneOff, title: "Suppress opt-outs", text: "Block future marketing sends immediately." },
            ].map((step, index) => (
              <div key={step.title} className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500 text-white">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border bg-background px-3 py-1 text-sm font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Safeguards"
            title="The controls businesses expect before sending at scale"
            description="Each safeguard is shown as part of the product experience so compliance feels operational, not decorative."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {complianceFeatures.map((feature) => (
              <FeatureCard key={feature.title} item={feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Regulations"
            title="Designed around the rules marketing teams already face"
            description="The page keeps the important compliance labels visible without turning the experience into a wall of legal text."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {regulations.map((item) => (
              <div key={item.title} className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-300">
                  {item.title}
                </div>
                <p className="mt-4 leading-7 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-lg border bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(14,165,233,0.12),rgba(255,255,255,0.7))] p-8 text-center shadow-sm sm:p-12 dark:bg-card">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-300" />
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Launch campaigns with permission and proof in place
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Use FlowSmartly to collect consent, manage suppression, and keep SMS
            and email campaigns accountable from day one.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700" asChild>
              <Link href="/register">
                Get started free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link href="/sms-terms">Read SMS terms</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
