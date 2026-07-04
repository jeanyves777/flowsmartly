"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import {
  Globe, Sparkles, ExternalLink, LayoutTemplate, Eye, MousePointerClick, FileStack, BarChart3,
  RefreshCw, Trash2, Pencil, ChevronDown, FileText, AlertTriangle, Check, X, Link2, Rocket, ArrowLeft,
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

const SITE_PAGES = ["Home", "About", "Services", "Pricing", "Contact", "Gallery", "Testimonials", "FAQ", "Blog"];
const SITE_STYLES = ["Modern", "Bold", "Minimal", "Elegant", "Playful", "Corporate"];
const LANDING_GOALS = ["Lead capture", "Sell a product", "Event signup", "Waitlist", "Book a call", "Download"];
const LANDING_STYLES = ["Modern", "Bold", "Minimal", "Elegant", "Playful"];
const WB_FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

// The builder cycles buildStatus through idle → building → deploying → built/error.
// "building" AND "deploying" are both in-progress: treat them the same so the spinner,
// poll, and status badge stay live until the deploy actually finishes. [[site-builder lifecycle]]
const isBuildingStatus = (s?: string) => s === "building" || s === "deploying";

/* ── Websites ─────────────────────────────────────────────────────────── */
export function FocusedWeb({ refreshKey, onAsk, onOpenView }: { refreshKey?: number; onAsk: (prompt: string) => void; onOpenView?: (key: string) => void }) {
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
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
  const liveSites = sites.filter((s) => s.status?.toUpperCase() === "PUBLISHED").length;
  const buildingSites = sites.filter((s) => isBuildingStatus(s.buildStatus)).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + primary action */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          {/* New website is GENERATIVE — but gather the brief in the UI FIRST, then
              spin the agent with the full details (no back-and-forth in chat). */}
          <button
            onClick={() => setBuilding(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Sparkles className="h-4 w-4" /> New website
          </button>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><Globe className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Your websites</span></div>
            <div className="space-y-1.5">
              <StatRow icon={Globe} label="Sites" value={String(sites.length)} sub={liveSites ? `${liveSites} live` : buildingSites ? `${buildingSites} building` : undefined} />
              <StatRow icon={FileStack} label="Pages" value={String(totalPages)} />
              <StatRow icon={BarChart3} label="Views" value={totalViews.toLocaleString()} />
            </div>
          </div>

          {/* vertical section menu (single section today; sticky-menu pattern) */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            <button
              className="flex w-full items-center gap-2.5 rounded-xl bg-brand-500/10 px-3 py-2.5 text-[13px] font-semibold text-brand-500"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-start">Websites</span>
              {sites.length > 0 && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-500">{sites.length}</span>}
            </button>
            <button
              onClick={() => onOpenView?.("domains")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Link2 className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-start">Domains</span>
            </button>
          </nav>
        </aside>

        {/* RIGHT: the website list OR the inline brief builder, full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {building ? (
            <WebsiteBuilder onCancel={() => setBuilding(false)} onBuild={(prompt) => { setBuilding(false); onAsk(prompt); }} />
          ) : (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-500" />
              <h3 className="text-[13px] font-bold">Your websites</h3>
              {sites.length > 0 && <NewBtn className="ms-auto" label="New website" onClick={() => setBuilding(true)} />}
            </div>
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
              <Empty title="No website yet" sub="Tell us a few details and the agent builds a branded multi-page site." cta="Create a website" onCta={() => setBuilding(true)} />
            )}
          </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Website builder — an INLINE brief in the view; gathers details, THEN spins
      the agent (not a modal — renders in the right pane). ───────────────────── */
function WebsiteBuilder({ onCancel, onBuild }: { onCancel: () => void; onBuild: (prompt: string) => void }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [pages, setPages] = useState<string[]>(["Home", "About", "Services", "Contact"]);
  const [style, setStyle] = useState("Modern");
  const [cta, setCta] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  // Prefill the name from the Brand Kit so the user rarely types from scratch.
  useEffect(() => {
    let alive = true;
    fetch("/api/brand").then((r) => r.json()).then((j) => { if (alive && j?.data?.brandKit?.name) setName((n) => n || String(j.data.brandKit.name)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const togglePage = (p: string) => setPages((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));

  const build = () => {
    if (!name.trim()) { setError("Add your business / site name."); return; }
    if (!goal.trim()) { setError("Tell the agent what the site is for."); return; }
    if (!pages.length) { setError("Pick at least one page."); return; }
    const prompt = [
      "Build me a complete, branded multi-page WEBSITE now using my brand kit. I've given you everything below — do NOT ask me questions; design and build it, write the copy, and publish a preview.",
      `- Site / business name: ${name.trim()}`,
      `- What it's for: ${goal.trim()}`,
      `- Pages to include: ${pages.join(", ")}`,
      `- Style / vibe: ${style}`,
      cta.trim() ? `- Primary call-to-action: ${cta.trim()}` : "",
      details.trim() ? `- Highlight / key details: ${details.trim()}` : "",
      "Confirm in ONE short sentence when it's live.",
    ].filter(Boolean).join("\n");
    onBuild(prompt);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onCancel} aria-label="Back" className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-tight">New website</h3>
          <p className="text-[11.5px] text-muted-foreground">Fill the brief — the agent builds it with these details, no back-and-forth.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2">
        <Field label="Business / site name *"><input value={name} onChange={(e) => setName(e.target.value)} className={WB_FIELD} placeholder="Acme Plumbing" /></Field>
        <Field label="Main call-to-action"><input value={cta} onChange={(e) => setCta(e.target.value)} className={WB_FIELD} placeholder="Book a call · Get a quote · Shop now" /></Field>
        <div className="sm:col-span-2">
          <Field label="What's the site for? *"><textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className={cn(WB_FIELD, "resize-y")} placeholder="e.g. a plumbing business in Austin that takes booking requests and shows services & reviews" /></Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Pages to include</p>
          <div className="flex flex-wrap gap-1.5">
            {SITE_PAGES.map((p) => (
              <button key={p} onClick={() => togglePage(p)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold transition", pages.includes(p) ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{p}</button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Style / vibe</p>
          <div className="flex flex-wrap gap-1.5">
            {SITE_STYLES.map((s) => (
              <button key={s} onClick={() => setStyle(s)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold transition", style === s ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{s}</button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Field label="Anything to highlight? (optional)"><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className={cn(WB_FIELD, "resize-y")} placeholder="Services, offers, hours, what makes you different…" /></Field>
        </div>
        {error && <p className="text-[12px] text-rose-500 sm:col-span-2">{error}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button onClick={build} className="inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Build my website</button>
        <button onClick={onCancel} className="rounded-[11px] px-3 py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
        <span className="ms-auto hidden text-[11px] text-muted-foreground sm:block">Uses your brand kit · the agent confirms before anything bills.</span>
      </div>
    </section>
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
  const [building, setBuilding] = useState(false);

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
  const livePages = pages.filter((p) => p.status?.toUpperCase() === "PUBLISHED").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + primary action */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          {/* New page is GENERATIVE — but gather the brief in the UI FIRST, then
              spin the agent with the full details (no back-and-forth in chat). */}
          <button
            onClick={() => setBuilding(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Sparkles className="h-4 w-4" /> New page
          </button>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><LayoutTemplate className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Your landing pages</span></div>
            <div className="space-y-1.5">
              <StatRow icon={LayoutTemplate} label="Pages" value={String(pages.length)} sub={livePages ? `${livePages} live` : undefined} />
              <StatRow icon={Eye} label="Views" value={totalViews.toLocaleString()} />
              <StatRow icon={MousePointerClick} label="Leads" value={totalSubs.toLocaleString()} />
            </div>
          </div>

          {/* vertical section menu (single section; sticky-menu pattern) */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            <button
              className="flex w-full items-center gap-2.5 rounded-xl bg-brand-500/10 px-3 py-2.5 text-[13px] font-semibold text-brand-500"
            >
              <LayoutTemplate className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-start">Landing pages</span>
              {pages.length > 0 && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-500">{pages.length}</span>}
            </button>
          </nav>
        </aside>

        {/* RIGHT: the landing-page grid OR the inline brief builder, full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {building ? (
            <LandingBuilder onCancel={() => setBuilding(false)} onBuild={(prompt) => { setBuilding(false); onAsk(prompt); }} />
          ) : (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-brand-500" />
              <h3 className="text-[13px] font-bold">Your landing pages</h3>
              {pages.length > 0 && <NewBtn className="ms-auto" label="New page" onClick={() => setBuilding(true)} />}
            </div>
            {pages.length ? (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
              <Empty title="No landing pages yet" sub="Spin up a high-converting page for a campaign or offer." cta="Create a landing page" onCta={() => setBuilding(true)} />
            )}
          </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Landing-page builder — an INLINE brief in the view; gathers details, THEN
      spins the agent (not a modal — renders in the right pane). ──────────────── */
function LandingBuilder({ onCancel, onBuild }: { onCancel: () => void; onBuild: (prompt: string) => void }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("Lead capture");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [cta, setCta] = useState("");
  const [style, setStyle] = useState("Modern");
  const [brand, setBrand] = useState("");
  const [error, setError] = useState("");

  // Prefill a brand name from the Brand Kit so the page is on-brand by default.
  useEffect(() => {
    let alive = true;
    fetch("/api/brand").then((r) => r.json()).then((j) => { if (alive && j?.data?.brandKit?.name) setBrand((b) => b || String(j.data.brandKit.name)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const build = () => {
    if (!title.trim()) { setError("Give your landing page a title / name."); return; }
    if (!offer.trim()) { setError("Tell the agent what you're promoting (the offer)."); return; }
    const prompt = [
      "Build me ONE high-converting LANDING PAGE now using my brand kit. I've given you everything below — do NOT ask me questions; design and build it, write the copy, and generate + publish a preview.",
      `- Page title / name: ${title.trim()}`,
      `- Goal: ${goal}`,
      `- The offer (what I'm promoting + the hook): ${offer.trim()}`,
      audience.trim() ? `- Target audience: ${audience.trim()}` : "",
      cta.trim() ? `- Primary call-to-action: ${cta.trim()}` : "",
      `- Style / vibe: ${style}`,
      brand.trim() ? `- Brand: ${brand.trim()}` : "",
      "Confirm in ONE short sentence when it's live.",
    ].filter(Boolean).join("\n");
    onBuild(prompt);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onCancel} aria-label="Back" className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-tight">New landing page</h3>
          <p className="text-[11.5px] text-muted-foreground">Fill the brief — the agent builds it with these details, no back-and-forth.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2">
        <Field label="Page title / name *"><input value={title} onChange={(e) => setTitle(e.target.value)} className={WB_FIELD} placeholder="Spring Launch · Free SEO Guide" /></Field>
        <Field label="Primary call-to-action"><input value={cta} onChange={(e) => setCta(e.target.value)} className={WB_FIELD} placeholder='e.g. "Get the free guide"' /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Goal</p>
          <div className="flex flex-wrap gap-1.5">
            {LANDING_GOALS.map((g) => (
              <button key={g} onClick={() => setGoal(g)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold transition", goal === g ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{g}</button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Field label="The offer * — what you're promoting + the hook"><textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={2} className={cn(WB_FIELD, "resize-y")} placeholder="e.g. a free 10-page SEO checklist that gets local businesses to page 1 — sign up to download it" /></Field>
        </div>
        <Field label="Target audience"><input value={audience} onChange={(e) => setAudience(e.target.value)} className={WB_FIELD} placeholder="Small business owners in Austin" /></Field>
        <Field label="Brand"><input value={brand} onChange={(e) => setBrand(e.target.value)} className={WB_FIELD} placeholder="Your brand / business name" /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Style / vibe</p>
          <div className="flex flex-wrap gap-1.5">
            {LANDING_STYLES.map((s) => (
              <button key={s} onClick={() => setStyle(s)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold transition", style === s ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{s}</button>
            ))}
          </div>
        </div>
        {error && <p className="text-[12px] text-rose-500 sm:col-span-2">{error}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button onClick={build} className="inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Build my page</button>
        <button onClick={onCancel} className="rounded-[11px] px-3 py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
        <span className="ms-auto hidden text-[11px] text-muted-foreground sm:block">Uses your brand kit · the agent confirms before anything bills.</span>
      </div>
    </section>
  );
}

/* ── shared ───────────────────────────────────────────────────────────── */
// Compact summary row for the sticky left card (mirrors adbuilder StatRow).
function StatRow({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground/80">{sub}</p>}
      </div>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

function NewBtn({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm", className)}>
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
