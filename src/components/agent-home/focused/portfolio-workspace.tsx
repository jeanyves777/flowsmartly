"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, ExternalLink, Rocket, Share2, ShieldCheck, Eye, Lock, Globe,
  Copy, Check, Wand2, LayoutTemplate, UserRound, Building2, FileUp, Download,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { QRCodeDisplay } from "@/components/data-forms/qr-code-display";

/**
 * Portfolio / Digital Resume Studio surface (/home/portfolio). Real data via
 * /api/portfolios; content authoring is agent-driven (build_portfolio /
 * edit_portfolio) while style, the email-verification gate, publish, domain and
 * the branded QR are direct UI controls. No legacy links. [[new-design-no-legacy]]
 */

// Client-safe style list (mirrors PORTFOLIO_TEMPLATES; kept out of the server engine
// so this client bundle never imports prisma).
const TEMPLATES = [
  { id: "spotlight", name: "Spotlight", video: true },
  { id: "cinematic", name: "Cinematic", video: true },
  { id: "showcase", name: "Showcase", video: false },
  { id: "editorial", name: "Editorial", video: false },
  { id: "neon", name: "Neon", video: true },
  { id: "card", name: "Résumé Card", video: false },
];

interface Portfolio {
  id: string;
  kind: "business" | "personal";
  name: string;
  slug: string;
  customDomain: string | null;
  headline: string | null;
  theme: { accent: string; accent2: string; font: string; template: string };
  access: { view: "public" | "email"; download: "public" | "email" | "off"; seoIndex: boolean };
  status: "DRAFT" | "PUBLISHED";
  url: string;
  totalViews: number;
  sections: { id: string; type: string; title: string; visible: boolean }[];
}

export function FocusedPortfolio({
  refreshKey,
  onAsk,
  onOpenView,
  working,
}: {
  refreshKey?: number;
  onAsk: (prompt: string) => void;
  onOpenView?: (key: string) => void;
  working?: boolean;
}) {
  const [p, setP] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [tab, setTab] = useState<"preview" | "share">("preview");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/portfolios");
      const j = await r.json();
      setP((j?.portfolio as Portfolio) || null);
    } catch {
      setP(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshKey, load]);

  const patch = useCallback(async (body: Record<string, unknown>) => {
    if (!p) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/portfolios/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j?.portfolio) { setP(j.portfolio as Portfolio); setPreviewKey((k) => k + 1); }
    } finally {
      setSaving(false);
    }
  }, [p]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading Portfolio Studio…" /></div>;
  }

  // ── Empty state → build CTA (agent-driven) ────────────────────────────────
  if (!p) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500">New agent skill</div>
          <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">Your own portfolio &amp; résumé site</h1>
          <p className="mt-1.5 max-w-xl text-[14px] text-muted-foreground">
            The agent builds a complete, on-brand site — you edit it here, then publish it to a real domain with a branded QR to share anywhere.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => onAsk("Build me a BUSINESS portfolio site. Ask me anything you need, use my Brand Kit, then build it.")}
              className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:border-brand-500/50 hover:shadow-lg"
            >
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white"><Building2 className="h-5 w-5" /></div>
              <div className="text-[15px] font-bold">Business Portfolio</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Services, projects, testimonials &amp; contact — built from your Brand Kit.</p>
            </button>
            <button
              onClick={() => onAsk("Build me a PERSONAL résumé site. I'll upload my CV — read it and build my experience, skills and education.")}
              className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:border-brand-500/50 hover:shadow-lg"
            >
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white"><UserRound className="h-5 w-5" /></div>
              <div className="text-[15px] font-bold">Personal · Digital Résumé</div>
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><FileUp className="h-3.5 w-3.5" /> Upload a CV — the agent builds every section.</p>
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0 text-brand-500" />
            Goes live on <b className="text-foreground">yourname.flowsmartly.site</b> free, or the agent buys &amp; attaches a custom domain — you approve the charge first.
          </div>
        </div>
      </div>
    );
  }

  // ── Studio ────────────────────────────────────────────────────────────────
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = p.url.startsWith("http") ? p.url : `${origin}${p.url}`;
  const previewSrc = `/pf/${p.slug}?v=${previewKey}`;
  const isLive = p.status === "PUBLISHED";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: summary + controls */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[300px] lg:shrink-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${isLive ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-600"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} /> {isLive ? "Live" : "Draft"}
            </span>
            {saving && <span className="text-[11px] text-muted-foreground">Saving…</span>}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2">
              {p.kind === "personal" ? <UserRound className="h-4 w-4 text-brand-500" /> : <Building2 className="h-4 w-4 text-brand-500" />}
              <span className="truncate text-[12.5px] font-bold">{p.name}</span>
            </div>
            <StatRow icon={Eye} label="Views" value={p.totalViews.toLocaleString()} />
            <StatRow icon={LayoutTemplate} label="Style" value={TEMPLATES.find((t) => t.id === p.theme.template)?.name || p.theme.template} />
            <StatRow icon={Globe} label="URL" value={p.customDomain || `${p.slug}.flowsmartly.site`} />
          </div>

          {!isLive ? (
            <button onClick={() => patch({ status: "PUBLISHED" })} disabled={saving} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60">
              <Rocket className="h-4 w-4" /> Publish &amp; go live
            </button>
          ) : (
            <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-border bg-card px-3.5 py-2.5 text-[13px] font-semibold hover:border-brand-500/50">
              <ExternalLink className="h-4 w-4" /> Open public page
            </a>
          )}

          {/* Style */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="px-1 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Style · portfolio, not a website</div>
            <div className="grid grid-cols-3 gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => patch({ template: t.id })} className={`relative rounded-lg border px-1.5 py-2 text-[10.5px] font-semibold transition ${p.theme.template === t.id ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40"}`}>
                  {t.video && <span className="absolute right-1 top-1 text-[8px]">▶</span>}
                  {t.name}
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[10.5px] text-muted-foreground">▶ styles support a full-bleed video hero. Ask the agent to set hero media.</p>
          </div>

          {/* Access & gate */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="px-1 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Access &amp; privacy</div>
            <GateToggle label="Require email to VIEW" icon={ShieldCheck} on={p.access.view === "email"} onToggle={(on) => patch({ access: { view: on ? "email" : "public" } })} />
            <GateToggle label="Require email to DOWNLOAD" icon={Download} on={p.access.download === "email"} onToggle={(on) => patch({ access: { download: on ? "email" : "public" } })} />
            <p className="mt-1.5 px-1 text-[10.5px] text-muted-foreground">Verified visitors are saved to your Contacts as leads.</p>
          </div>

          {/* Domain */}
          <button onClick={() => onOpenView?.("domains")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-border bg-card px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground">
            <Globe className="h-4 w-4" /> Attach a custom domain
          </button>
        </aside>

        {/* RIGHT: preview / share */}
        <section className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <div className="inline-flex rounded-[10px] border border-border bg-card p-0.5">
              <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye}>Preview</TabBtn>
              <TabBtn active={tab === "share"} onClick={() => setTab("share")} icon={Share2}>Share</TabBtn>
            </div>
            <button onClick={() => onAsk("Edit my portfolio: ")} disabled={working} className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-brand-500/40 bg-brand-500/5 px-3 py-1.5 text-[12px] font-semibold text-brand-500 disabled:opacity-60">
              <Wand2 className="h-3.5 w-3.5" /> Edit with the agent
            </button>
          </div>

          {tab === "preview" ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <iframe key={previewKey} src={previewSrc} title="Portfolio preview" className="h-[72vh] w-full bg-white" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[12.5px] font-bold">Share your {p.kind === "personal" ? "résumé" : "portfolio"}</div>
                <p className="mt-1 text-[12px] text-muted-foreground">Send the link, or the branded QR — colored to your accent.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={shareUrl} className="flex-1 rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none" />
                  <button onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 text-[12.5px] font-semibold text-white">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {!isLive && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-amber-600"><Lock className="h-3.5 w-3.5" /> Publish first so the link works for visitors.</p>}
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <QRCodeDisplay url={shareUrl} size={230} title={p.name} callToAction="SCAN ME" brand={{ name: p.name, colors: { primary: p.theme.accent, accent: p.theme.accent2 } }} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="ml-auto max-w-[150px] truncate text-[12px] font-semibold">{value}</span>
    </div>
  );
}

function GateToggle({ label, icon: Icon, on, onToggle }: { label: string; icon: React.ElementType; on: boolean; onToggle: (on: boolean) => void }) {
  return (
    <button onClick={() => onToggle(!on)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left">
      <Icon className={`h-3.5 w-3.5 ${on ? "text-brand-500" : "text-muted-foreground"}`} />
      <span className="text-[12px]">{label}</span>
      <span className={`ml-auto flex h-4 w-7 items-center rounded-full px-0.5 transition ${on ? "bg-brand-500" : "bg-muted"}`}>
        <span className={`h-3 w-3 rounded-full bg-white transition ${on ? "translate-x-3" : ""}`} />
      </span>
    </button>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}
