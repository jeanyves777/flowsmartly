"use client";

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import { Globe, Sparkles, ExternalLink, LayoutTemplate, Eye, MousePointerClick, FileStack, BarChart3 } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Web — split into focused, single-purpose surfaces so each type gets its OWN
 * organized view (not all mixed in one scroll): FocusedWeb = Websites, while
 * FocusedLanding = Landing pages and FocusedDomains (its own file) = Domains.
 * Real data (GET /api/websites, /api/landing-pages); creation drives the agent.
 * No legacy links. [[new-design-no-legacy]]
 */

interface Website { id: string; name?: string; slug?: string; status?: string; buildStatus?: string; pageCount?: number; totalViews?: number; customDomain?: string | null; }
interface Landing { id: string; title?: string; status?: string; thumbnailUrl?: string | null; views?: number; submissions?: number; conversionRate?: number; }

const BUILD_SITE_PROMPT = "Help me build a website — ask me my business name, what it's for, and the style, then create it.";
const BUILD_PAGE_PROMPT = "Help me create a landing page — ask me the goal, offer, and audience, then generate it.";

/* ── Websites ─────────────────────────────────────────────────────────── */
export function FocusedWeb({ refreshKey, onAsk }: { refreshKey?: number; onAsk: (prompt: string) => void }) {
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/websites").then((r) => r.json()).catch(() => null).then((w) => {
      if (!alive) return;
      if (Array.isArray(w?.websites)) setSites(w.websites);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your websites…" /></div>;
  }

  const totalPages = sites.reduce((n, s) => n + (s.pageCount ?? 0), 0);
  const totalViews = sites.reduce((n, s) => n + (s.totalViews ?? 0), 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {sites.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Kpi icon={Globe} label="Sites" value={String(sites.length)} />
            <Kpi icon={FileStack} label="Pages" value={String(totalPages)} />
            <Kpi icon={BarChart3} label="Views" value={totalViews.toLocaleString()} />
          </div>
        )}
        <Section title="Your websites" icon={Globe} action={<NewBtn label="New website" onClick={() => onAsk(BUILD_SITE_PROMPT)} />}>
          {sites.length ? (
            <div className="space-y-2.5">
              {sites.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Globe className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{s.name || "Untitled site"}</p>
                    <p className="text-[11.5px] text-muted-foreground">{(s.pageCount ?? 0)} pages · {(s.totalViews ?? 0).toLocaleString()} views</p>
                  </div>
                  <StatusBadge status={s.status} build={s.buildStatus} />
                  {s.customDomain && (
                    <a href={`https://${s.customDomain}`} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Visit</a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No website yet" sub="The agent builds a branded multi-page site in minutes." cta="Create a website" onCta={() => onAsk(BUILD_SITE_PROMPT)} />
          )}
        </Section>
      </div>
    </div>
  );
}

/* ── Landing pages ────────────────────────────────────────────────────── */
export function FocusedLanding({ refreshKey, onAsk }: { refreshKey?: number; onAsk: (prompt: string) => void }) {
  const [pages, setPages] = useState<Landing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/landing-pages?limit=24").then((r) => r.json()).catch(() => null).then((l) => {
      if (!alive) return;
      if (Array.isArray(l?.data?.pages)) setPages(l.data.pages);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your landing pages…" /></div>;
  }

  const totalViews = pages.reduce((n, p) => n + (p.views ?? 0), 0);
  const totalSubs = pages.reduce((n, p) => n + (p.submissions ?? 0), 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {pages.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Kpi icon={LayoutTemplate} label="Pages" value={String(pages.length)} />
            <Kpi icon={Eye} label="Views" value={totalViews.toLocaleString()} />
            <Kpi icon={MousePointerClick} label="Leads" value={totalSubs.toLocaleString()} />
          </div>
        )}
        <Section title="Your landing pages" icon={LayoutTemplate} action={<NewBtn label="New page" onClick={() => onAsk(BUILD_PAGE_PROMPT)} />}>
          {pages.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {pages.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div className="grid aspect-[16/9] place-items-center bg-background">
                    {p.thumbnailUrl ? <Image src={p.thumbnailUrl} alt="" width={320} height={180} className="h-full w-full object-cover" unoptimized /> : <LayoutTemplate className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12.5px] font-semibold">{p.title || "Untitled page"}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-x-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {(p.views ?? 0).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {(p.submissions ?? 0).toLocaleString()}</span>
                      {typeof p.conversionRate === "number" && <span>{p.conversionRate.toFixed(1)}% conv.</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No landing pages yet" sub="Spin up a high-converting page for a campaign or offer." cta="Create a landing page" onCta={() => onAsk(BUILD_PAGE_PROMPT)} />
          )}
        </Section>
      </div>
    </div>
  );
}

/* ── shared ───────────────────────────────────────────────────────────── */
function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <p className="mt-1 text-[18px] font-bold">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, action, children }: { title: string; icon: ElementType; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-500" />
        <h3 className="text-[13px] font-bold">{title}</h3>
        {action && <span className="ms-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}

function NewBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
      <Sparkles className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function StatusBadge({ status, build }: { status?: string; build?: string }) {
  const published = status?.toUpperCase() === "PUBLISHED";
  const building = build === "building";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", building ? "bg-amber-500/10 text-amber-500" : published ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
      {building ? "Building…" : published ? "Live" : "Draft"}
    </span>
  );
}

function Empty({ title, sub, cta, onCta }: { title: string; sub: string; cta: string; onCta: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
      <button onClick={onCta} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
        <Sparkles className="h-4 w-4" /> {cta}
      </button>
    </div>
  );
}
