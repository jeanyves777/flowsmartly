"use client";

import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import { Users, UserPlus, Upload, Mail, MessageSquare, Star, FileText, CalendarDays, X, Check } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Outreach — a deep new-design CRM surface (the Outreach workspace canvas):
 * contacts + audience stats. Direct UI for the data actions — "Add contact"
 * opens a real form, "Import" uploads a CSV (POST /api/contacts + /import) — so a
 * click means do-it-in-the-UI, not a chat prompt. The agent stays in the chat on
 * the left for help, and the generative "More outreach" tasks (proposals,
 * follow-ups) still drive it. No legacy links. [[surface-buttons-are-ui-actions]]
 */

interface Contact { id: string; name?: string; email?: string | null; phone?: string | null; status?: string; emailOptedIn?: boolean; smsOptedIn?: boolean; company?: string | null; imageUrl?: string | null; lists?: { id: string; name: string }[]; }
interface Stats { total?: number; active?: number; unsubscribed?: number; emailOptedIn?: number; smsOptedIn?: number; }

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const EMPTY_FORM = { firstName: "", lastName: "", email: "", phone: "", tags: "" };

export function FocusedOutreach({ refreshKey, onOpenView }: { refreshKey?: number; onOpenView: (key: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/contacts?limit=30").then((r) => r.json());
      if (j?.success && j.data) {
        if (Array.isArray(j.data.contacts)) setContacts(j.data.contacts);
        if (j.data.stats) setStats(j.data.stats);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!email && !phone) { setError("Add at least an email or a phone."); return; }
    setSaving(true); setError("");
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const r = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: form.firstName.trim() || undefined, lastName: form.lastName.trim() || undefined, email: email || undefined, phone: phone || undefined, tags }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        setAdding(false); setForm(EMPTY_FORM); setNotice("Contact added.");
        await load();
        setTimeout(() => setNotice(""), 2000);
      } else {
        setError(j?.error?.message || "Could not add the contact.");
      }
    } catch {
      setError("Could not add the contact.");
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImporting(true); setNotice("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("duplicateStrategy", "skip");
      const j = await fetch("/api/contacts/import", { method: "POST", body: fd }).then((r) => r.json());
      if (j?.success && j.data) {
        setNotice(`Imported ${j.data.imported ?? 0}${j.data.skipped ? `, skipped ${j.data.skipped}` : ""}.`);
        await load();
      } else {
        setNotice(j?.error?.message || "Import failed — check the CSV columns (name, email, phone…).");
      }
    } catch {
      setNotice("Import failed.");
    } finally {
      setImporting(false);
      setTimeout(() => setNotice(""), 4000);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your audience…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} className="hidden" />
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
            {notice && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-500"><Check className="h-3.5 w-3.5" /> {notice}</span>}
            <div className="ms-auto flex items-center gap-1.5">
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                {importing ? <FlowLoader size={14} /> : <Upload className="h-3.5 w-3.5" />} Import
              </button>
              <button onClick={() => { setAdding((v) => !v); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><UserPlus className="h-3.5 w-3.5" /> Add contact</button>
            </div>
          </div>

          {/* inline add form — clicking "Add contact" opens this, not a chat prompt */}
          {adding && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First name" className={FIELD} />
                <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last name" className={FIELD} />
                <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" type="email" className={FIELD} />
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone (+15551234567)" className={FIELD} />
              </div>
              <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Tags (comma-separated, e.g. VIP, lead)" className={cn(FIELD, "mt-2.5")} />
              {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {saving ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} Save contact
                </button>
                <button onClick={() => { setAdding(false); setForm(EMPTY_FORM); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
              </div>
            </div>
          )}

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
          ) : !adding ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No contacts yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Add your first contact or import a CSV — then the agent can help you reach them.</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => { setAdding(true); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><UserPlus className="h-4 w-4" /> Add a contact</button>
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Upload className="h-4 w-4" /> Import CSV</button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Other outreach — each card opens its actual feature, not a chat prompt */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">More outreach</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Quick icon={Star} title="Reviews & local SEO" desc="Get more reviews and fix your listings." onClick={() => onOpenView("reviews")} />
            <Quick icon={FileText} title="Pitch & proposals" desc="Draft a winning proposal for a client." onClick={() => onOpenView("pitch")} />
            <Quick icon={Mail} title="Follow-ups" desc="Set up automated follow-up sequences." onClick={() => onOpenView("automations")} />
            <Quick icon={CalendarDays} title="Forms & events" desc="Collect leads with a form or event page." onClick={() => onOpenView("forms")} />
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
