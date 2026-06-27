"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import { Globe, Plus, X, Check, Star, Trash2, ShieldCheck, ShieldAlert, ExternalLink, Link2, Server, BadgeCheck, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Domains — a deep new-design surface (the Web workspace canvas): manage custom
 * domains with their registrar / SSL / verification status, set a primary, and
 * connect or remove domains. The data actions are REAL UI — "Connect domain"
 * opens an inline form (POST /api/domains/connect), and set-primary / verify /
 * remove are direct API calls that refresh the list. A click means do-it-in-the-
 * UI, not a chat prompt. No legacy links. [[surface-buttons-are-ui-actions]]
 */

interface DomainAction { type: string; label: string; description: string; priority: number; }
interface Domain {
  id: string;
  domainName: string;
  tld?: string | null;
  registrarStatus?: string | null;
  sslStatus?: string | null;
  verificationStatus?: string | null;
  isPrimary?: boolean;
  isConnected?: boolean;
  autoRenew?: boolean;
  whoisPrivacy?: boolean;
  daysUntilExpiry?: number | null;
  expiresAt?: string | null;
  nextAction?: DomainAction;
}
interface Summary {
  total?: number;
  registered?: number;
  connected?: number;
  primary?: string | null;
  verified?: number;
  sslReady?: number;
  needsAction?: number;
  expiringSoon?: number;
}

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

const sslReady = (s?: string | null) => s === "active" || s === "active_certificate";
const isVerified = (d: Domain) => d.verificationStatus === "verified";

function expiryLabel(days?: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return "expired";
  if (days <= 30) return `${days}d left`;
  return null;
}

export function FocusedDomains({ refreshKey }: { refreshKey?: number }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // `${id}:${action}`

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/domains").then((r) => r.json());
      if (j?.success && j.data) {
        if (Array.isArray(j.data.domains)) setDomains(j.data.domains as Domain[]);
        if (j.data.summary) setSummary(j.data.summary as Summary);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const openAdd = () => { setValue(""); setError(""); setNotice(""); setAdding(true); };

  const connect = async () => {
    const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!domain) { setError("Enter a domain like example.com"); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/domains/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const j = await r.json();
      if (r.ok && j?.success !== false) {
        setAdding(false); setValue("");
        setNotice(`${domain} connected — add the FlowSmartly TXT record, then verify ownership.`);
        await load();
      } else {
        setError(j?.error?.message || "Could not connect that domain.");
      }
    } catch {
      setError("Could not connect that domain.");
    } finally {
      setSaving(false);
    }
  };

  const act = async (d: Domain, action: "primary" | "verify" | "remove") => {
    const key = `${d.id}:${action}`;
    setBusy(key); setNotice(""); setError("");
    try {
      if (action === "primary") {
        const r = await fetch(`/api/domains/${d.id}/set-primary`, { method: "POST" });
        const j = await r.json();
        if (!r.ok || j?.success === false) { setError(j?.error?.message || "Could not set primary domain."); return; }
      } else if (action === "verify") {
        const r = await fetch(`/api/domains/${d.id}/verify`, { method: "POST" });
        const j = await r.json();
        if (r.ok && j?.success !== false) setNotice(`${d.domainName} verified.`);
        else setError(j?.error?.message || "Verification failed — check the TXT record and try again.");
      } else {
        const r = await fetch(`/api/domains/${d.id}`, { method: "DELETE" });
        const j = await r.json();
        if (!r.ok || j?.success === false) { setError(j?.error?.message || "Could not remove that domain."); return; }
      }
      await load();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your domains…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* header */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Globe className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold">Domains</h2>
              <p className="truncate text-[12px] text-muted-foreground">
                {summary.primary ? <>Primary: <span className="font-medium text-foreground">{summary.primary}</span></> : "Connect a custom domain to brand your sites and store."}
              </p>
            </div>
            <button onClick={openAdd} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Connect domain
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Globe} label="Domains" value={String(summary.total ?? domains.length)} />
            <Kpi icon={BadgeCheck} label="Verified" value={String(summary.verified ?? domains.filter(isVerified).length)} />
            <Kpi icon={ShieldCheck} label="SSL ready" value={String(summary.sslReady ?? domains.filter((d) => sslReady(d.sslStatus)).length)} />
            <Kpi icon={AlertTriangle} label="Need action" value={String(summary.needsAction ?? 0)} tone={(summary.needsAction ?? 0) > 0 ? "text-amber-500" : undefined} />
          </div>
        </section>

        {/* inline connect form — a click opens this, not a chat prompt */}
        {adding && (
          <section className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 sm:p-5">
            <p className="mb-2.5 text-[12.5px] font-semibold">Connect a domain you own</p>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Domain</span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
                  placeholder="example.com"
                  autoFocus
                  className={FIELD}
                />
              </label>
              <button onClick={connect} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                {saving ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} Connect
              </button>
              <button onClick={() => { setAdding(false); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">After connecting, you&apos;ll add a FlowSmartly TXT record at your DNS provider, then verify ownership here.</p>
            {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
          </section>
        )}

        {notice && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-[12.5px] text-emerald-600 dark:text-emerald-400">{notice}</p>
        )}
        {!adding && error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3.5 py-2.5 text-[12.5px] text-rose-500">{error}</p>
        )}

        {/* list */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Your domains</h3>
          {domains.length ? (
            <div className="space-y-2.5">
              {domains.map((d) => {
                const verified = isVerified(d);
                const ssl = sslReady(d.sslStatus);
                const exp = expiryLabel(d.daysUntilExpiry);
                return (
                  <div key={d.id} className="rounded-xl border border-border bg-muted/30 p-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-brand-500"><Globe className="h-4.5 w-4.5" /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold">{d.domainName}</span>
                          {d.isPrimary && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500"><Star className="h-3 w-3" /> Primary</span>
                          )}
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", d.isConnected ? "bg-violet-500/10 text-violet-500" : "bg-muted text-muted-foreground")}>
                            {d.isConnected ? <Link2 className="h-3 w-3" /> : <Server className="h-3 w-3" />}{d.isConnected ? "Connected" : "Registered"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <StatusPill ok={verified} okLabel="Verified" badLabel={d.verificationStatus === "failed" ? "Verify failed" : "Unverified"} okIcon={BadgeCheck} badIcon={ShieldAlert} />
                          <StatusPill ok={ssl} okLabel="SSL active" badLabel="SSL pending" okIcon={ShieldCheck} badIcon={Clock} />
                          {exp && (
                            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", d.daysUntilExpiry != null && d.daysUntilExpiry <= 0 ? "text-rose-500" : "text-amber-500")}>
                              <Clock className="h-3 w-3" /> {exp}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* actions */}
                      <div className="ms-auto flex flex-wrap items-center gap-1.5">
                        {d.isConnected && !verified && (
                          <button onClick={() => act(d, "verify")} disabled={busy === `${d.id}:verify`} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                            {busy === `${d.id}:verify` ? <FlowLoader size={13} /> : <BadgeCheck className="h-3.5 w-3.5" />} Verify
                          </button>
                        )}
                        {!d.isPrimary && (
                          <button onClick={() => act(d, "primary")} disabled={busy === `${d.id}:primary` || !verified} title={verified ? undefined : "Verify ownership before setting primary"} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                            {busy === `${d.id}:primary` ? <FlowLoader size={13} /> : <Star className="h-3.5 w-3.5" />} Set primary
                          </button>
                        )}
                        <a href={`https://${d.domainName}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" /> Visit
                        </a>
                        <button onClick={() => act(d, "remove")} disabled={busy === `${d.id}:remove`} aria-label={`Remove ${d.domainName}`} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-rose-500/60 hover:text-rose-500 disabled:opacity-60">
                          {busy === `${d.id}:remove` ? <FlowLoader size={13} /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* next-action hint from the API */}
                    {d.nextAction && d.nextAction.priority <= 2 && d.nextAction.type !== "healthy" && (
                      <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
                        <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" /> {d.nextAction.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet-500/10 text-brand-500"><Globe className="h-6 w-6" /></span>
              <p className="mt-3 text-[13px] font-medium">No custom domains yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Connect a domain you already own to brand your websites, store, and links.</p>
              <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Connect a domain</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className={cn("flex items-center gap-1.5 text-muted-foreground", tone)}><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <p className={cn("mt-1 text-[18px] font-extrabold leading-none", tone)}>{value}</p>
    </div>
  );
}

function StatusPill({ ok, okLabel, badLabel, okIcon: OkIcon, badIcon: BadIcon }: { ok: boolean; okLabel: string; badLabel: string; okIcon: ElementType; badIcon: ElementType }) {
  const Icon = ok ? OkIcon : BadIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", ok ? "text-emerald-500" : "text-muted-foreground")}>
      <Icon className="h-3 w-3" /> {ok ? okLabel : badLabel}
    </span>
  );
}
