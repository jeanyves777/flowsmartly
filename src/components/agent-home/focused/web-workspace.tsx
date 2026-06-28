"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import {
  Globe, Sparkles, ExternalLink, LayoutTemplate, Eye, MousePointerClick, FileStack, BarChart3,
  RefreshCw, Trash2, Pencil, ChevronDown, FileText, AlertTriangle, Check, X, Link2, Rocket,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Web — split into focused, single-purpose surfaces so each type gets its OWN
 * organized view (not all mixed in one scroll): FocusedWeb = Websites, while
 * FocusedLanding = Landing pages and FocusedDomains (its own file) = Domains.
 * Real data (GET /api/websites, /api/landing-pages); creation drives the agent.
 * No legacy links. [[new-design-no-legacy]]
 */

interface WebsitePage { id: string; title?: string; slug?: string; isHomePage?: boolean; status?: string; }
interface Website { id: string; name?: string; slug?: string; status?: string; buildStatus?: string; lastBuildError?: string | null; pageCount?: number; totalViews?: number; customDomain?: string | null; pages?: WebsitePage[]; }
interface Landing { id: string; title?: string; status?: string; thumbnailUrl?: string | null; views?: number; submissions?: number; conversionRate?: number; }

const BUILD_SITE_PROMPT = "Help me build a website — ask me my business name, what it's for, and the style, then create it.";
const BUILD_PAGE_PROMPT = "Help me create a landing page — ask me the goal, offer, and audience, then generate it.";

// The builder cycles buildStatus through idle → building → deploying → built/error.
// "building" AND "deploying" are both in-progress: treat them the same so the spinner,
// poll, and status badge stay live until the deploy actually finishes. [[site-builder lifecycle]]
const isBuildingStatus = (s?: string) => s === "building" || s === "deploying";

/* ── Websites ─────────────────────────────────────────────────────────── */
export function FocusedWeb({ refreshKey, onAsk, onOpenView }: { refreshKey?: number; onAsk: (prompt: string) => void; onOpenView?: (key: string) => void }) {
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (): Promise<Website[]> => {
    try {
      const r = await fetch("/api/websites");
      const w = await r.json();
      const list = Array.isArray(w?.websites) ? (w.websites as Website[]) : [];
      setSites(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  // Poll the list until no site is still building or deploying.
  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const list = await load();
      if (!list.some((s) => isBuildingStatus(s.buildStatus))) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 3500);
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await load();
      if (!alive) return;
      setLoading(false);
      // If any site is mid-build on first load, start polling.
      if (list.some((s) => isBuildingStatus(s.buildStatus))) startPoll();
    })();
    return () => { alive = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [refreshKey, load, startPoll]);

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
                <SiteRow
                  key={s.id}
                  site={s}
                  open={openId === s.id}
                  onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
                  onChanged={load}
                  onBuildStarted={startPoll}
                  onOpenView={onOpenView}
                />
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

/* ── Website row (collapsed summary + expandable detail/edit) ─────────────── */
type Confirm = null | "delete" | "publish";

function SiteRow({ site, open, onToggle, onChanged, onBuildStarted, onOpenView }: {
  site: Website;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<Website[]>;
  onBuildStarted: () => void;
  onOpenView?: (key: string) => void;
}) {
  const [busy, setBusy] = useState<null | "rebuild" | "delete" | "publish">(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const building = isBuildingStatus(site.buildStatus) || busy === "rebuild";
  const buildError = site.buildStatus === "error";
  const published = site.status?.toUpperCase() === "PUBLISHED";

  async function rebuild() {
    setErr(null);
    setBusy("rebuild");
    try {
      const r = await fetch(`/api/websites/${site.id}/rebuild`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || "Rebuild failed"); return; }
      onBuildStarted();       // begin polling buildStatus
      await onChanged();      // pick up buildStatus === "building"
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    setErr(null);
    setBusy("delete");
    try {
      const r = await fetch(`/api/websites/${site.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || "Delete failed"); setBusy(null); return; }
      setConfirm(null);
      await onChanged();
    } catch {
      setErr("Network error — please try again.");
      setBusy(null);
    }
  }

  async function doPublish() {
    setErr(null);
    setBusy("publish");
    try {
      const r = await fetch(`/api/websites/${site.id}/publish`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || "Publish failed"); return; }
      setConfirm(null);
      await onChanged();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30">
      {/* Summary header */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <button onClick={onToggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500" aria-label="Toggle details">
          <Globe className="h-[18px] w-[18px]" />
        </button>
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-semibold">{site.name || "Untitled site"}</p>
          <p className="text-[11.5px] text-muted-foreground">{(site.pageCount ?? 0)} pages · {(site.totalViews ?? 0).toLocaleString()} views{site.customDomain ? ` · ${site.customDomain}` : ""}</p>
        </button>
        <StatusBadge status={site.status} build={site.buildStatus} />
        {site.customDomain && (
          <a href={`https://${site.customDomain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Visit</a>
        )}
        <button onClick={onToggle} className="grid h-8 w-8 place-items-center rounded-[10px] border border-border text-muted-foreground hover:text-foreground" aria-label="Toggle details">
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {buildError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Last build failed{site.lastBuildError ? `: ${site.lastBuildError}` : ""}. Rebuild to retry.</span>
            </div>
          )}

          {/* Pages list */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Pages</p>
            {site.pages && site.pages.length ? (
              <div className="space-y-1">
                {site.pages.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[12px] font-medium">{p.title || (p.isHomePage ? "Home" : p.slug || "Untitled")}</span>
                    {p.isHomePage && <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">Home</span>}
                    <span className="ms-auto truncate text-[11px] text-muted-foreground">/{p.slug || ""}</span>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">{(site.pageCount ?? 0)} page{(site.pageCount ?? 0) === 1 ? "" : "s"} — open the editor to manage them.</p>
            )}
          </div>

          {/* Custom domain row */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold">Custom domain</p>
              <p className="truncate text-[11.5px] text-muted-foreground">{site.customDomain || "Not connected — uses the free flowsmartly URL."}</p>
            </div>
            <button
              onClick={() => onOpenView?.("domains")}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" /> Manage domain
            </button>
          </div>

          {/* Inline edit of core fields */}
          {editing ? (
            <EditCore site={site} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); await onChanged(); }} onBuildStarted={onBuildStarted} />
          ) : (
            <>
              {err && <p className="text-[12px] font-medium text-red-500">{err}</p>}

              {/* Confirm panels */}
              {confirm === "delete" && (
                <ConfirmPanel
                  tone="danger"
                  title="Delete this website?"
                  detail={`“${site.name || "Untitled site"}” and its ${site.pageCount ?? 0} page${(site.pageCount ?? 0) === 1 ? "" : "s"} will be archived and taken offline. This frees your 1-site slot so you can build a new one.`}
                  confirmLabel="Delete website"
                  busy={busy === "delete"}
                  onConfirm={doDelete}
                  onCancel={() => { setConfirm(null); setErr(null); }}
                />
              )}
              {confirm === "publish" && (
                <ConfirmPanel
                  tone="brand"
                  title="Publish this website?"
                  detail="All draft pages go live at your public URL immediately. Visitors will see the latest content."
                  confirmLabel="Publish now"
                  busy={busy === "publish"}
                  onConfirm={doPublish}
                  onCancel={() => { setConfirm(null); setErr(null); }}
                />
              )}

              {/* Actions */}
              {!confirm && (
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBtn icon={RefreshCw} label={building ? "Rebuilding…" : "Rebuild"} onClick={rebuild} disabled={building} spinning={building} />
                  {!published && (
                    <ActionBtn icon={Rocket} label="Publish" onClick={() => { setErr(null); setConfirm("publish"); }} disabled={!!busy} variant="brand" />
                  )}
                  <ActionBtn icon={Pencil} label="Edit details" onClick={() => { setErr(null); setEditing(true); }} disabled={!!busy} />
                  <ActionBtn icon={Trash2} label="Delete" onClick={() => { setErr(null); setConfirm("delete"); }} disabled={!!busy} variant="danger" />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Inline edit of core site fields (name + headline/tagline) ───────────── */
function EditCore({ site, onCancel, onSaved, onBuildStarted }: {
  site: Website;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onBuildStarted: () => void;
}) {
  const [name, setName] = useState(site.name || "");
  const [headline, setHeadline] = useState("");
  const [tagline, setTagline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pull current headline/tagline from the site's structured data.
  useEffect(() => {
    let alive = true;
    fetch(`/api/websites/${site.id}/site-data`).then((r) => r.json()).catch(() => null).then((j) => {
      if (!alive) return;
      const c = j?.data?.company ?? {};
      setHeadline(typeof c.description === "string" ? c.description : "");
      setTagline(typeof c.tagline === "string" ? c.tagline : "");
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [site.id]);

  async function save() {
    setErr(null);
    const trimmedName = name.trim();
    if (!trimmedName) { setErr("Name is required."); return; }
    setSaving(true);
    try {
      // 1) Rename the site record (top-level column).
      if (trimmedName !== (site.name || "")) {
        const r = await fetch(`/api/websites/${site.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
        });
        if (!r.ok) { const j = await r.json().catch(() => null); setErr(j?.error || "Could not save name."); setSaving(false); return; }
      }
      // 2) Headline (company.description) + tagline live in siteData/data.ts.
      const r2 = await fetch(`/api/websites/${site.id}/update-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { company: { name: trimmedName, tagline: tagline.trim(), description: headline.trim() } } }),
      });
      if (!r2.ok) { const j = await r2.json().catch(() => null); setErr(j?.error || "Could not save content."); setSaving(false); return; }

      // Content lives in the generated files — rebuild to publish the change.
      const r3 = await fetch(`/api/websites/${site.id}/rebuild`, { method: "POST" });
      if (r3.ok) onBuildStarted();
    } catch {
      setErr("Network error — please try again.");
      setSaving(false);
      return;
    }
    // Success — clear busy before onSaved() collapses/unmounts this editor.
    setSaving(false);
    await onSaved();
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Pencil className="h-3.5 w-3.5" /> Edit core details</p>
      <Field label="Site name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name" className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
      </Field>
      <Field label="Headline" hint="The hero one-liner shown on your home page.">
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} disabled={!loaded} placeholder={loaded ? "What you do, in one sentence" : "Loading…"} className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60 disabled:opacity-60" />
      </Field>
      <Field label="Tagline" hint="A short slogan under your name.">
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={!loaded} placeholder={loaded ? "Your slogan" : "Loading…"} className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60 disabled:opacity-60" />
      </Field>
      {err && <p className="text-[12px] font-medium text-red-500">{err}</p>}
      <p className="text-[11px] text-muted-foreground">Saving updates your site files and rebuilds so the changes go live.</p>
      <div className="flex items-center gap-2 pt-0.5">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
          {saving ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} {saving ? "Saving…" : "Save & rebuild"}
        </button>
        <button onClick={onCancel} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 disabled:opacity-60">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
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
  const building = isBuildingStatus(build);
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

function ActionBtn({ icon: Icon, label, onClick, disabled, spinning, variant = "default" }: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  variant?: "default" | "brand" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-60",
        variant === "brand" && "bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-sm",
        variant === "danger" && "border border-border text-red-500 hover:border-red-500/60 hover:bg-red-500/5",
        variant === "default" && "border border-border hover:border-brand-500/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} /> {label}
    </button>
  );
}

function ConfirmPanel({ tone, title, detail, confirmLabel, busy, onConfirm, onCancel }: {
  tone: "danger" | "brand";
  title: string;
  detail: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const danger = tone === "danger";
  return (
    <div className={cn("rounded-lg border px-3 py-3", danger ? "border-red-500/30 bg-red-500/5" : "border-brand-500/30 bg-brand-500/5")}>
      <p className={cn("flex items-center gap-1.5 text-[12.5px] font-bold", danger ? "text-red-500" : "text-brand-500")}>
        {danger ? <AlertTriangle className="h-3.5 w-3.5" /> : <Rocket className="h-3.5 w-3.5" />} {title}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60",
            danger ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-r from-brand-500 to-violet-500",
          )}
        >
          {busy ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} {busy ? "Working…" : confirmLabel}
        </button>
        <button onClick={onCancel} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-60">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
