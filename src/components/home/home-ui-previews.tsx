import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Globe2,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

type Channel = {
  label: string;
  color: string;
};

type Row = {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
};

const channels: Channel[] = [
  { label: "Facebook", color: "bg-blue-600" },
  { label: "Instagram", color: "bg-pink-500" },
  { label: "TikTok", color: "bg-zinc-950 dark:bg-zinc-100" },
  { label: "LinkedIn", color: "bg-sky-700" },
  { label: "Google", color: "bg-emerald-500" },
];

const heroQueue = [
  { time: "09:00", title: "Launch post", status: "Ready" },
  { time: "11:30", title: "Email offer", status: "Draft" },
  { time: "14:00", title: "SMS follow-up", status: "Approved" },
];

const heroMetrics = [
  { label: "Reach", value: "84K", color: "text-sky-600 dark:text-sky-300" },
  { label: "Orders", value: "128", color: "text-emerald-600 dark:text-emerald-300" },
  { label: "Reviews", value: "4.8", color: "text-amber-600 dark:text-amber-300" },
];

export function HeroWorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <div className="overflow-hidden rounded-lg border bg-white text-zinc-950 shadow-2xl shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-black/35">
        <div className="flex min-h-14 items-center justify-between border-b bg-zinc-50 px-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold">Growth command center</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Spring launch campaign</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {["Draft", "Approve", "Publish"].map((item, index) => (
              <span
                key={item}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold",
                  index === 2
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-white text-zinc-600 shadow-sm dark:bg-zinc-950 dark:text-zinc-300"
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="grid min-h-[520px] lg:grid-cols-[72px_1fr_320px]">
          <aside className="hidden border-r bg-zinc-950 p-3 dark:border-zinc-800 lg:block">
            <div className="grid gap-3">
              {[Sparkles, CalendarDays, Mail, BarChart3, ShieldCheck].map((Icon, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg",
                    index === 1 ? "bg-blue-600 text-white" : "bg-white/8 text-white/70"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              ))}
            </div>
          </aside>

          <main className="grid gap-4 p-4 md:grid-cols-[0.92fr_1.08fr] md:p-5">
            <div className="rounded-lg border bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold">Publishing queue</p>
                <span className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                  3 today
                </span>
              </div>
              <div className="grid gap-3">
                {heroQueue.map((item) => (
                  <div key={item.title} className="grid grid-cols-[48px_1fr] gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
                    <div className="rounded-md bg-zinc-100 py-2 text-center text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                      {item.time}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                  Approval status
                </div>
                <div className="space-y-2">
                  {[72, 48, 88].map((width, index) => (
                    <div key={index} className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold">Post composer</p>
                <div className="flex -space-x-2">
                  {channels.slice(0, 4).map((channel) => (
                    <span
                      key={channel.label}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-black text-white dark:border-zinc-950 dark:text-zinc-950",
                        channel.color
                      )}
                    >
                      {channel.label[0]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  <p className="text-sm font-semibold">AI caption draft</p>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-3 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-3 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {heroMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
                      <p className={cn("text-2xl font-black", metric.color)}>{metric.value}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4 dark:border-zinc-800">
                  <p className="mb-3 text-sm font-bold">Channel preview</p>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-500/15 dark:to-emerald-500/15" />
                    <div className="h-2 w-5/6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-2 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                </div>
                <div className="rounded-lg border p-4 dark:border-zinc-800">
                  <p className="mb-3 text-sm font-bold">Performance</p>
                  <div className="flex h-24 items-end gap-2">
                    {[34, 62, 48, 74, 56, 92, 78].map((height, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-md bg-gradient-to-t from-violet-500 to-cyan-400"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:border-l lg:border-t-0">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold">Connected channels</p>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="grid gap-3">
              {channels.map((channel) => (
                <div key={channel.label} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
                  <div className="flex items-center gap-3">
                    <span className={cn("h-3 w-3 rounded-full", channel.color)} />
                    <span className="text-sm font-semibold">{channel.label}</span>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Live</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm font-bold">Next best action</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Boost the top post and send the saved audience a follow-up.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function CampaignWorkflowVisual() {
  return (
    <div className="overflow-hidden rounded-lg border bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="border-b bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Campaign workflow</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">AI, social, email, SMS, ads</p>
          </div>
          <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            94% ready
          </span>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-2.5">
          {[
            { icon: Sparkles, title: "AI draft", meta: "Brand voice matched" },
            { icon: CalendarDays, title: "Publishing", meta: "Queued by channel" },
            { icon: Mail, title: "Email and SMS", meta: "Consent checked" },
            { icon: BarChart3, title: "Report", meta: "Revenue tagged" },
          ].map((item, index) => (
            <div key={item.title} className="flex items-center gap-3 rounded-lg border bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white", index === 0 ? "bg-blue-600" : index === 1 ? "bg-violet-600" : index === 2 ? "bg-emerald-600" : "bg-amber-500")}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">Performance loop</p>
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="flex h-36 items-end gap-2">
            {[38, 54, 45, 72, 61, 88, 76, 96].map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-md bg-gradient-to-t from-blue-600 via-cyan-400 to-emerald-300"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["Reach", "Leads", "Sales"].map((item) => (
              <div key={item} className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-zinc-950">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item}</p>
                <p className="mt-1 text-lg font-black">{item === "Reach" ? "84K" : item === "Leads" ? "1.2K" : "$8.4K"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type PlatformWorkspaceVisualProps = {
  label: string;
  title: string;
  stat: string;
  statLabel: string;
  accent: string;
  items: string[];
};

export function PlatformWorkspaceVisual({
  label,
  title,
  stat,
  statLabel,
  accent,
  items,
}: PlatformWorkspaceVisualProps) {
  return (
    <div className="rounded-lg border bg-white p-4 text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{title}</p>
        </div>
        <span className={cn("rounded-md bg-gradient-to-r px-3 py-1 text-xs font-bold text-white", accent)}>
          Live
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_0.78fr]">
        <div className="rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-40 items-end gap-2">
            {[40, 68, 52, 84, 64, 94, 76].map((height, index) => (
              <div
                key={index}
                className={cn("flex-1 rounded-md bg-gradient-to-t", accent)}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-2.5">
          <div className="rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-3xl font-black">{stat}</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{statLabel}</p>
          </div>
          {items.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border bg-zinc-50 px-3 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductPreviewShell({
  title,
  label,
  icon: Icon,
  rows,
  children,
}: {
  title: string;
  label: string;
  icon: LucideIcon;
  rows: Row[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
          </div>
        </div>
        <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          Active
        </span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 rounded-lg border bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white", row.color)}>
                <row.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">{row.label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function FlowShopVisual() {
  return (
    <ProductPreviewShell
      title="FlowShop workspace"
      label="Storefront, checkout, orders"
      icon={ShoppingBag}
      rows={[
        { icon: Package, label: "Product page", value: "AI copy ready", color: "bg-violet-600" },
        { icon: CreditCard, label: "Checkout", value: "Payments connected", color: "bg-emerald-600" },
        { icon: BarChart3, label: "Store revenue", value: "+22% weekly", color: "bg-sky-600" },
      ]}
    >
      <div className="rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
            <div className="h-20 rounded-lg bg-gradient-to-br from-violet-100 to-amber-100 dark:from-violet-500/15 dark:to-amber-500/15" />
            <div className="mt-3 h-3 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="grid gap-3">
            <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Today&apos;s orders</p>
              <p className="mt-1 text-2xl font-black">128</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Conversion</p>
              <p className="mt-1 text-2xl font-black">7.4%</p>
            </div>
          </div>
        </div>
      </div>
    </ProductPreviewShell>
  );
}

export function LocalListingsVisual() {
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[640px] overflow-visible sm:h-[460px] lg:h-[560px] lg:max-w-[680px]">
      <Image
        src={illustrationImages.listSmartlyLocalListingsCutout}
        alt="Local listings, reviews, map pins, business profile, and directory sync assets for ListSmartly"
        fill
        sizes="(min-width: 1024px) 680px, 92vw"
        unoptimized
        className="object-contain object-bottom drop-shadow-[0_30px_60px_rgba(13,148,136,0.16)] dark:drop-shadow-[0_30px_60px_rgba(0,0,0,0.42)]"
      />
    </div>
  );
}

export function MessagingComplianceVisual() {
  return (
    <ProductPreviewShell
      title="Messaging center"
      label="Email, SMS, consent"
      icon={MessageSquare}
      rows={[
        { icon: Mail, label: "Welcome email", value: "42% open rate", color: "bg-sky-600" },
        { icon: Send, label: "SMS reminder", value: "Consent verified", color: "bg-emerald-600" },
        { icon: ShieldCheck, label: "Compliance", value: "Opt-out active", color: "bg-zinc-700" },
      ]}
    >
      <div className="rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">Campaign health</p>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-300">98%</span>
          </div>
          <div className="space-y-3">
            {[98, 84, 71].map((width, index) => (
              <div key={index}>
                <div className="mb-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{index === 0 ? "Consent" : index === 1 ? "Deliverability" : "Follow-up"}</span>
                  <span>{width}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProductPreviewShell>
  );
}

export function MarketplaceVisual() {
  return (
    <ProductPreviewShell
      title="Agent marketplace"
      label="Match, hire, track work"
      icon={Users}
      rows={[
        { icon: Search, label: "Search agents", value: "Matched by goals", color: "bg-violet-600" },
        { icon: Star, label: "Verified rating", value: "4.9 average", color: "bg-amber-500" },
        { icon: BarChart3, label: "Work tracking", value: "Scorecard active", color: "bg-emerald-600" },
      ]}
    >
      <div className="rounded-lg border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-2.5">
          {[
            { name: "Growth strategist", score: "92" },
            { name: "Ad specialist", score: "88" },
            { name: "Content operator", score: "95" },
          ].map((agent) => (
            <div key={agent.name} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">{agent.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Available this week</p>
                </div>
              </div>
              <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {agent.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ProductPreviewShell>
  );
}
