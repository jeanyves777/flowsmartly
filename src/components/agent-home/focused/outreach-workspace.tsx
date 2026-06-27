"use client";

import { useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Users, UserPlus, Upload, Mail, MessageSquare, Star, FileText, CalendarDays, Sparkles } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Outreach — a deep new-design CRM surface (the Outreach workspace canvas):
 * contacts + audience stats, with agent-driven add/import and quick actions for
 * the rest of outreach (reviews, proposals, follow-ups, forms). Real data
 * (GET /api/contacts). No legacy links. [[new-design-no-legacy]]
 */

interface Contact { id: string; name?: string; email?: string | null; phone?: string | null; status?: string; emailOptedIn?: boolean; smsOptedIn?: boolean; company?: string | null; imageUrl?: string | null; lists?: { id: string; name: string }[]; }
interface Stats { total?: number; active?: number; unsubscribed?: number; emailOptedIn?: number; smsOptedIn?: number; }

export function FocusedOutreach({ onAsk }: { onAsk: (prompt: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/contacts?limit=30")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.success && j.data) {
          if (Array.isArray(j.data.contacts)) setContacts(j.data.contacts);
          if (j.data.stats) setStats(j.data.stats);
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your audience…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Users} label="Contacts" value={(stats.total ?? contacts.length).toLocaleString()} />
          <Kpi icon={Users} label="Active" value={(stats.active ?? 0).toLocaleString()} />
          <Kpi icon={Mail} label="Email opt-in" value={(stats.emailOptedIn ?? 0).toLocaleString()} />
          <Kpi icon={MessageSquare} label="SMS opt-in" value={(stats.smsOptedIn ?? 0).toLocaleString()} />
        </div>

        {/* Contacts */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Contacts</h3>
            <div className="ms-auto flex items-center gap-1.5">
              <button onClick={() => onAsk("Help me import my contacts — I'll share a CSV or paste them, then add them to my audience.")} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Upload className="h-3.5 w-3.5" /> Import</button>
              <button onClick={() => onAsk("Help me add a new contact — ask me their name, email, and phone, then save them.")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><UserPlus className="h-3.5 w-3.5" /> Add contact</button>
            </div>
          </div>
          {contacts.length ? (
            <div className="space-y-2">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  {c.imageUrl ? (
                    <Image src={c.imageUrl} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" unoptimized />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/30 text-[11px] font-bold text-brand-500">{(c.name || c.email || "?").slice(0, 1).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{c.name || c.email || c.phone || "Contact"}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{[c.email, c.company].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", c.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{c.status || "active"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No contacts yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Import your list or add your first contact — the agent will help you reach them.</p>
              <button onClick={() => onAsk("Help me import or add my first contacts so I can start reaching my audience.")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Add contacts</button>
            </div>
          )}
        </section>

        {/* Other outreach — agent quick actions */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">More outreach</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Quick icon={Star} title="Reviews & local SEO" desc="Get more reviews and fix your listings." onClick={() => onAsk("Help me get more reviews and improve my local SEO / business listings.")} />
            <Quick icon={FileText} title="Pitch & proposals" desc="Draft a winning proposal for a client." onClick={() => onAsk("Help me write a client proposal — ask me about the client and the offer.")} />
            <Quick icon={Mail} title="Follow-ups" desc="Set up automated follow-up sequences." onClick={() => onAsk("Help me set up an automated follow-up sequence for new leads.")} />
            <Quick icon={CalendarDays} title="Forms & events" desc="Collect leads with a form or event page." onClick={() => onAsk("Help me create a lead-capture form or an event page.")} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}

function Quick({ icon: Icon, title, desc, onClick }: { icon: ElementType; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left transition hover:border-brand-500/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11.5px] leading-snug text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
