"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  ChartNoAxesCombined,
  Check,
  Database,
  Eye,
  MessageSquareText,
  Radar,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";

const SIGNALS: { icon: LucideIcon; label: string; detail: string; status: string }[] = [
  { icon: MessageSquareText, label: "Social intent", detail: "18 high-intent comments", status: "+24%" },
  { icon: ShoppingBag, label: "Commerce", detail: "3 products gaining interest", status: "$4.8k" },
  { icon: Radar, label: "Local discovery", detail: "2 visibility gaps found", status: "Fix" },
];

const SYSTEMS = [
  { icon: Database, title: "One customer memory", body: "Unify posts, comments, conversations, clicks, leads and purchases into a living engagement profile." },
  { icon: Sparkles, title: "Opportunity intelligence", body: "Flow.AI finds revenue gaps, prepares the next best action and explains why it matters." },
  { icon: MessageSquareText, title: "Conversations that convert", body: "Move from comment to DM, email, SMS, appointment and purchase without losing context." },
  { icon: ShoppingBag, title: "Agent-ready commerce", body: "Keep products, policies and inventory structured for both people and AI shopping assistants." },
  { icon: Eye, title: "AI visibility", body: "Understand how your business appears across search, local discovery and emerging answer engines." },
  { icon: ShieldCheck, title: "Governed by default", body: "Preserve provenance, approvals and disclosure status. Nothing spends or publishes without your control." },
];

export function GrowthCommandCenter() {
  return (
    <section id="platform" className="relative overflow-hidden border-y border-white/10 bg-[#07100f] px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="grid gap-7 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.24em] text-emerald-400">The growth command center</p>
              <h2 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl">
                Every signal becomes the next approved action.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-white/55 lg:ml-auto">
              FlowSmartly connects customer data, creative, conversations, campaigns, commerce and local discovery—so your business can move as one system.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.12fr_.88fr]">
          <Reveal>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1715] shadow-[0_30px_100px_rgba(0,0,0,.35)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-[#06100e]"><ChartNoAxesCombined className="h-5 w-5" /></span>
                  <div><p className="text-sm font-bold text-white">Weekly opportunity audit</p><p className="text-xs text-white/40">Across your connected business</p></div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-300">LIVE</span>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-[.88fr_1.12fr]">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/35">Incoming signals</p>
                  <div className="mt-4 space-y-3">
                    {SIGNALS.map(({ icon: Icon, label, detail, status }) => (
                      <div key={label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3">
                        <Icon className="h-4 w-4 shrink-0 text-sky-300" />
                        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">{label}</p><p className="truncate text-[11px] text-white/40">{detail}</p></div>
                        <span className="text-xs font-bold text-emerald-300">{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.035] p-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Recommended action</div>
                  <h3 className="mt-4 text-xl font-bold leading-tight text-white">Turn product interest into a coordinated launch.</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">A high-intent audience is forming around your summer collection. Flow.AI prepared a social, email and remarketing sequence.</p>
                  <div className="mt-5 space-y-2">
                    {["Audience assembled from engagement", "6 campaign assets prepared", "Budget and disclosure check complete"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-white/65"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/12 text-emerald-300"><Check className="h-3 w-3" /></span>{item}</div>
                    ))}
                  </div>
                  <button className="mt-5 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#07100f] transition-colors hover:bg-emerald-50">
                    Review prepared campaign <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 px-5 py-3 text-[11px] text-white/38">
                <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-400" /> Human approval required</span>
                <span>Source data attached</span><span>Creative provenance recorded</span>
              </div>
            </div>
          </Reveal>

          <RevealGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1" stagger={0.05}>
            {SYSTEMS.slice(0, 3).map(({ icon: Icon, title, body }) => (
              <RevealItem key={title}>
                <div className="group flex h-full gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-5 transition-colors hover:border-emerald-400/25 hover:bg-white/[.045]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-emerald-300"><Icon className="h-5 w-5" /></span>
                  <div><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-white/45">{body}</p></div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>

        <RevealGroup className="mt-5 grid gap-3 md:grid-cols-3" stagger={0.06}>
          {SYSTEMS.slice(3).map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[.025] p-5">
                <Icon className="h-5 w-5 text-sky-300" /><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-white/45">{body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
