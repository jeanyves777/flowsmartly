"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, ExternalLink, Rocket, Share2, ShieldCheck, Eye, Lock, Globe,
  Copy, Check, Wand2, LayoutTemplate, UserRound, Building2, FileUp, FileText, Download, X,
} from "lucide-react";

type Attach = { dataUrl?: string; url?: string; name: string };
import { FlowLoader } from "@/components/shared/flow-loader";
import { QRCodeDisplay } from "@/components/data-forms/qr-code-display";
import { cn } from "@/lib/utils/cn";

const PF_FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

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
  onAskFiles,
  onOpenView,
  working,
}: {
  refreshKey?: number;
  onAsk: (prompt: string) => void;
  onAskFiles?: (prompt: string, attachments: Attach[]) => void;
  onOpenView?: (key: string) => void;
  working?: boolean;
}) {
  const [p, setP] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [tab, setTab] = useState<"preview" | "share">("preview");
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [armed, setArmed] = useState(false);

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

  // ── Starting point — brief BOTTOM-SHEET (system pattern; never a centered
  // modal). Auto-opens over the empty studio; matches Video/Pitch/Campaign.
  if (!p) {
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full place-items-center px-6 text-center">
          {armed ? (
            <BuildingCard onReset={() => { setArmed(false); setSheetOpen(true); }} />
          ) : (
            <div className="max-w-sm">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 text-white"><LayoutTemplate className="h-6 w-6" /></div>
              <h3 className="text-[16px] font-bold">Build your portfolio or résumé</h3>
              <p className="mx-auto mt-1 text-[12.5px] text-muted-foreground">Fill the brief and the agent builds a complete, on-brand site you edit here.</p>
              {!sheetOpen && (
                <button onClick={() => setSheetOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Start a brief</button>
              )}
            </div>
          )}
        </div>

        {sheetOpen && !armed && (
          <PortfolioBriefSheet
            onClose={() => setSheetOpen(false)}
            onBuild={(prompt) => { setSheetOpen(false); setArmed(true); onAsk(prompt); }}
            onBuildFiles={onAskFiles ? (prompt, atts) => { setSheetOpen(false); setArmed(true); onAskFiles(prompt, atts); } : undefined}
          />
        )}
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

/* ── Brief BOTTOM-SHEET (the system brief pattern — slides up from the bottom,
   full-width inset card over a dimmed backdrop; NEVER a centered modal). Mirrors
   pitch-studio / campaign-studio / video-workspace. [[reel-studio]] */
function PortfolioBriefSheet({ onClose, onBuild, onBuildFiles }: { onClose: () => void; onBuild: (prompt: string) => void; onBuildFiles?: (prompt: string, atts: Attach[]) => void }) {
  const [kind, setKind] = useState<"business" | "personal">("business");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [style, setStyle] = useState("spotlight");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<"brand" | "website" | "deck">("brand");
  const [file, setFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };

  const build = () => {
    if (!name.trim()) { setError("Add a name."); return; }
    const styleName = TEMPLATES.find((t) => t.id === style)?.name || style;
    const lines: string[] = [];
    const atts: Attach[] = [];
    if (kind === "personal") {
      lines.push("Build me a PERSONAL RÉSUMÉ site now with build_portfolio (kind:'personal').");
      if (file) { lines.push("I've attached my CV — READ it and extract experience, skills, education & projects."); atts.push({ dataUrl: file.dataUrl, name: file.name }); }
      else if (url.trim()) lines.push(`Read my profile at ${url.trim()} (use analyze_url / web_fetch) and build from it.`);
      else lines.push("I didn't attach a CV — ask me for the key details in ONE short message, then build.");
      lines.push(`- Name: ${name.trim()}`);
      if (goal.trim()) lines.push(`- Role / headline: ${goal.trim()}`);
    } else {
      lines.push("Build me a BUSINESS PORTFOLIO site now with build_portfolio (kind:'business').");
      if (source === "deck" && file) { lines.push("I've attached a company deck / profile — READ it and build from it."); atts.push({ dataUrl: file.dataUrl, name: file.name }); }
      else if (source === "website" && url.trim()) lines.push(`Import my website ${url.trim()} — read it (analyze_url) and pull the copy, services & images.`);
      else lines.push("Use my Brand Kit (logo, colours, voice) for everything.");
      lines.push(`- Business / name: ${name.trim()}`);
      if (goal.trim()) lines.push(`- What we do / it's for: ${goal.trim()}`);
    }
    lines.push(`- Style: ${styleName}`);
    lines.push("Don't ask more than one quick question if truly needed — otherwise build it and save it as a draft. Confirm in ONE short sentence when it's ready.");
    const prompt = lines.join("\n");
    if (atts.length && onBuildFiles) onBuildFiles(prompt, atts);
    else onBuild(prompt);
  };

  return (
    <>
      <button aria-label="Close brief" onClick={onClose} className="absolute inset-0 z-20 cursor-default bg-black/45 animate-in fade-in" />
      <div className="absolute inset-x-3 bottom-3 z-30 flex max-h-[86%] flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-8 duration-200 sm:inset-x-5 sm:bottom-4">
        <div className="relative flex items-center gap-2 px-3.5 pb-1.5 pt-3">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Brief</span>
          <span className="text-[11px] text-muted-foreground">new portfolio · the agent builds it from these details</span>
          <button onClick={onClose} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
          {/* Type */}
          <div className="mb-3.5 inline-flex rounded-[10px] border border-border bg-background p-0.5">
            <button onClick={() => setKind("business")} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition", kind === "business" ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground")}><Building2 className="h-3.5 w-3.5" /> Business portfolio</button>
            <button onClick={() => setKind("personal")} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition", kind === "personal" ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground")}><UserRound className="h-3.5 w-3.5" /> Personal résumé</button>
          </div>

          {/* Start from — the onboarding inputs */}
          <p className="mb-1.5 text-[11.5px] font-semibold">{kind === "personal" ? "Start from your résumé" : "Start from your business"} <span className="font-normal text-muted-foreground">{kind === "personal" ? "· the agent reads it and builds every section" : "· we reuse what you already have"}</span></p>
          {kind === "personal" ? (
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
              <FileDrop file={file} onPick={pickFile} label="Drop your résumé / CV here" hint="PDF, DOCX or an image · the agent reads it" />
              <div className="flex flex-col justify-center gap-2">
                <Field label="…or paste a LinkedIn / profile URL"><input value={url} onChange={(e) => setUrl(e.target.value)} className={PF_FIELD} placeholder="https://linkedin.com/in/you" /></Field>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3 shrink-0 text-brand-500" /> No file? Just hit Build — the agent asks you in chat.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-1.5">
                <SourceChip active={source === "brand"} onClick={() => setSource("brand")} icon={Wand2}>Use my Brand Kit</SourceChip>
                <SourceChip active={source === "website"} onClick={() => setSource("website")} icon={Globe}>Import my website</SourceChip>
                <SourceChip active={source === "deck"} onClick={() => setSource("deck")} icon={FileText}>Upload a deck / profile</SourceChip>
              </div>
              {source === "website" && <div className="mt-2"><Field label="Website URL"><input value={url} onChange={(e) => setUrl(e.target.value)} className={PF_FIELD} placeholder="https://yoursite.com" /></Field></div>}
              {source === "deck" && <div className="mt-2"><FileDrop file={file} onPick={pickFile} label="Upload a deck / company profile" hint="PDF or an image · the agent reads it" /></div>}
            </div>
          )}

          <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
            <Field label={kind === "personal" ? "Your name *" : "Business / studio name *"}><input value={name} onChange={(e) => setName(e.target.value)} className={PF_FIELD} placeholder={kind === "personal" ? "Jordan Lee" : "Northwind Studio"} /></Field>
            <Field label={kind === "personal" ? "Role / headline" : "What you do / what it's for"}><input value={goal} onChange={(e) => setGoal(e.target.value)} className={PF_FIELD} placeholder={kind === "personal" ? "Senior Product Designer — 8 yrs in fintech & health" : "Brand & product design studio for startups — services & projects"} /></Field>
          </div>

          {/* Style gallery — visual thumbnails, full width (up to 6 across) */}
          <p className="mb-2 mt-4 text-[11.5px] font-semibold">Style <span className="font-normal text-muted-foreground">· a portfolio look, not a website</span></p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setStyle(t.id)} className={cn("group overflow-hidden rounded-xl border-2 text-left transition", style === t.id ? "border-brand-500 ring-2 ring-brand-500/20" : "border-border hover:border-brand-500/40")}>
                <StyleThumb id={t.id} />
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <span className="truncate text-[11.5px] font-semibold">{t.name}</span>
                  {t.video && <span className="ms-auto inline-flex items-center gap-0.5 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-500">▶</span>}
                  {style === t.id && !t.video && <Check className="ms-auto h-3.5 w-3.5 shrink-0 text-brand-500" />}
                </div>
              </button>
            ))}
          </div>

          {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button onClick={build} className="inline-flex items-center gap-2 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Build it</button>
            <span className="text-[11px] text-muted-foreground">Free subdomain or a custom domain · the agent confirms before anything bills.</span>
          </div>
        </div>
      </div>
    </>
  );
}

function FileDrop({ file, onPick, label, hint }: { file: { name: string } | null; onPick: (f: File | null) => void; label: string; hint: string }) {
  return (
    <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0] || null); }} className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-background/40 px-4 py-5 text-center transition hover:border-brand-500/50">
      <input type="file" accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><FileUp className="h-4 w-4" /></span>
      {file ? <span className="text-[12.5px] font-semibold text-brand-500">✓ {file.name}</span> : <><span className="text-[12.5px] font-semibold">{label}</span><span className="text-[11px] text-muted-foreground">{hint}</span></>}
    </label>
  );
}

function SourceChip({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", active ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

/* Tiny CSS mock of each style so the user sees the look before picking. */
function StyleThumb({ id }: { id: string }) {
  const base = "h-[62px] w-full";
  switch (id) {
    case "spotlight":
      return <div className={cn(base, "flex flex-col justify-end gap-1 bg-gradient-to-br from-brand-500 to-violet-500 p-2")}><div className="h-1.5 w-2/3 rounded-full bg-white/90" /><div className="h-1 w-1/2 rounded-full bg-white/50" /></div>;
    case "cinematic":
      return <div className={cn(base, "relative grid place-items-center bg-gradient-to-b from-slate-500 to-slate-900")}><div className="grid h-5 w-5 place-items-center rounded-full bg-white/90 text-[8px] text-slate-900">▶</div><div className="absolute bottom-1.5 left-2 h-1 w-1/2 rounded-full bg-white/70" /></div>;
    case "showcase":
      return <div className={cn(base, "grid grid-cols-3 grid-rows-2 gap-1 bg-muted p-1.5")}>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-[3px] bg-brand-500/30" />)}</div>;
    case "editorial":
      return <div className={cn(base, "bg-[#efeadd] p-2")}><div className="mb-1 h-1.5 w-1/2 rounded-full bg-slate-700" /><div className="grid grid-cols-2 gap-1.5"><div className="h-7 rounded bg-slate-300" /><div className="space-y-1 pt-0.5"><div className="h-0.5 w-full rounded bg-slate-400" /><div className="h-0.5 w-5/6 rounded bg-slate-400" /><div className="h-0.5 w-full rounded bg-slate-400" /><div className="h-0.5 w-2/3 rounded bg-slate-400" /></div></div></div>;
    case "neon":
      return <div className={cn(base, "flex flex-col justify-end gap-1 bg-gradient-to-br from-fuchsia-600 via-purple-700 to-slate-900 p-2")}><div className="h-1.5 w-2/3 rounded-full bg-white/90" /><div className="h-1 w-1/3 rounded-full bg-cyan-300/80" /></div>;
    case "card":
      return <div className={cn(base, "flex items-center gap-2 bg-white p-2")}><div className="h-7 w-7 shrink-0 rounded-full bg-brand-500/30" /><div className="flex-1 space-y-1"><div className="h-1.5 w-2/3 rounded-full bg-slate-400" /><div className="h-1 w-1/2 rounded-full bg-brand-500/50" /><div className="h-0.5 w-full rounded-full bg-slate-200" /><div className="h-0.5 w-5/6 rounded-full bg-slate-200" /></div></div>;
    default:
      return <div className={cn(base, "bg-muted")} />;
  }
}

function BuildingCard({ onReset }: { onReset: () => void }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-3"><FlowLoader size={30} withMark /></div>
      <h3 className="text-[15px] font-bold">Building your site…</h3>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">The agent is on it — follow along in the chat. It'll appear here the moment it's ready.</p>
      <button onClick={onReset} className="mt-4 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Start over</button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
