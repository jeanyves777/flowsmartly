"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import {
  Globe, Plus, X, Check, Star, Trash2, ShieldCheck, ShieldAlert, ExternalLink,
  Link2, Server, BadgeCheck, Clock, AlertTriangle, RefreshCw, Search, ShoppingCart,
  ChevronDown, ChevronUp, CreditCard, Settings2, ListTree, Wand2, Store, Mail,
} from "lucide-react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Domains — a deep new-design surface (the Web workspace canvas): the full
 * lifecycle of a custom domain, all done IN the UI (a click does the work,
 * never opens a chat prompt). It covers:
 *   • Search & buy — register a brand-new domain (free claim on Pro, or paid
 *     via an INLINE Stripe PaymentElement; no hosted checkout, no legacy links).
 *   • Connect — bring a domain you already own and verify ownership via TXT.
 *   • Manage — per-domain expander with DNS records, settings (auto-renew /
 *     WHOIS privacy / link to store), and status actions (verify, set primary,
 *     retry registration, resend registrant email, remove).
 * No legacy surfaces are linked; external https links only ever point at the
 * live domain itself. [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

// One Stripe instance for the whole surface (the PAYMENT Elements wrapper needs
// its own clientSecret, which StripeProvider does not supply).
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface DomainAction { type: string; label: string; description: string; priority: number; }
interface Domain {
  id: string;
  domainName: string;
  tld?: string | null;
  registrarStatus?: string | null;
  registrarVerificationStatus?: string | null;
  sslStatus?: string | null;
  verificationStatus?: string | null;
  isPrimary?: boolean;
  isConnected?: boolean;
  isFree?: boolean;
  autoRenew?: boolean;
  whoisPrivacy?: boolean;
  storeId?: string | null;
  daysUntilExpiry?: number | null;
  expiresAt?: string | null;
  renewalPriceCents?: number | null;
  nameserverList?: string[];
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
interface SearchResult {
  domain: string;
  tld: string;
  available: boolean;
  retailCents: number;
  costCents: number;
  isFreeEligible: boolean;
}
interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
}
// A paid purchase that's awaiting inline PaymentElement confirmation.
interface PaymentPending {
  clientSecret: string;
  domainName: string;
}

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

const sslReady = (s?: string | null) => s === "active" || s === "active_certificate";
const isVerified = (d: Domain) => d.verificationStatus === "verified";
const registrationFailedOrPending = (s?: string | null) =>
  s === "registration_failed" || s === "pending_registration";
const registrantActionNeeded = (d: Domain) =>
  !d.isConnected &&
  !!d.registrarVerificationStatus &&
  d.registrarVerificationStatus !== "verified" &&
  d.registrarVerificationStatus !== "not_applicable";

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SRV"] as const;

function expiryLabel(days?: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return "expired";
  if (days <= 30) return `${days}d left`;
  return null;
}
function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
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

  // search & buy
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [buying, setBuying] = useState<string | null>(null); // `${domain}.${tld}`
  const [payment, setPayment] = useState<PaymentPending | null>(null);
  const [registering, setRegistering] = useState<string | null>(null); // domainName being polled

  // per-domain expander
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const runSearch = async () => {
    const query = searchTerm.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\..*$/, "").replace(/[^a-z0-9-]/g, "");
    if (!query) { setSearchError("Enter a name to search, e.g. mybrand"); return; }
    setSearching(true); setSearchError(""); setResults(null); setNotice(""); setError("");
    try {
      const r = await fetch("/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const j = await r.json();
      if (r.ok && j?.success && Array.isArray(j.data?.results)) {
        setResults(j.data.results as SearchResult[]);
      } else {
        setSearchError(j?.error?.message || "Search failed — try a different name.");
      }
    } catch {
      setSearchError("Search failed — try again.");
    } finally {
      setSearching(false);
    }
  };

  const buy = async (res: SearchResult) => {
    const full = `${res.domain}.${res.tld}`;
    setBuying(full); setError(""); setNotice(""); setSearchError("");
    try {
      const r = await fetch("/api/domains/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: res.domain, tld: res.tld, isFree: res.isFreeEligible }),
      });
      const j = await r.json();
      if (!r.ok || j?.success === false) {
        // Surface brand-identity / contact-info gating clearly instead of crashing.
        setSearchError(j?.error?.message || "Could not start that purchase.");
        return;
      }
      if (j.data?.clientSecret) {
        // Paid path → open the inline Stripe PaymentElement panel.
        setPayment({ clientSecret: j.data.clientSecret, domainName: j.data.domainName || full });
      } else {
        // Free path → registered immediately.
        setNotice(`${full} registered.`);
        setResults((prev) => prev ? prev.filter((x) => `${x.domain}.${x.tld}` !== full) : prev);
        await load();
      }
    } catch {
      setSearchError("Could not start that purchase.");
    } finally {
      setBuying(null);
    }
  };

  // After Stripe confirms, the domain registers via webhook — poll the list.
  const onPaid = (domainName: string) => {
    setPayment(null);
    setRegistering(domainName);
    setNotice(`Payment confirmed — registering ${domainName}…`);
    let attempts = 0;
    const maxAttempts = 15;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const j = await fetch("/api/domains").then((r) => r.json());
        const list: Domain[] = Array.isArray(j?.data?.domains) ? j.data.domains : [];
        const found = list.find((d) => d.domainName === domainName);
        if (found || attempts >= maxAttempts) {
          clearInterval(timer);
          setRegistering(null);
          if (Array.isArray(j?.data?.domains)) setDomains(list);
          if (j?.data?.summary) setSummary(j.data.summary as Summary);
          setResults((prev) => prev ? prev.filter((x) => `${x.domain}.${x.tld}` !== domainName) : prev);
          setNotice(found
            ? `${domainName} registered.`
            : `${domainName} is still processing — it should appear shortly.`);
        }
      } catch {
        if (attempts >= maxAttempts) { clearInterval(timer); setRegistering(null); }
      }
    }, 3000);
  };

  const act = async (d: Domain, action: "primary" | "verify" | "remove" | "retry" | "resend") => {
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
        else { setError(j?.error?.message || "Verification failed — check the TXT record and try again."); return; }
      } else if (action === "retry") {
        const r = await fetch(`/api/domains/${d.id}/retry`, { method: "POST" });
        const j = await r.json();
        if (r.ok && j?.success !== false) setNotice(j?.message || `${d.domainName} registration retried.`);
        else { setError(j?.error?.message || j?.error || "Retry failed — try again shortly."); return; }
      } else if (action === "resend") {
        const r = await fetch(`/api/domains/${d.id}/registrant-verification`, { method: "POST" });
        const j = await r.json();
        if (r.ok && j?.success !== false) setNotice(`Registrant verification email re-sent for ${d.domainName}.`);
        else { setError(j?.error?.message || "Could not resend the registrant email."); return; }
      } else {
        const r = await fetch(`/api/domains/${d.id}`, { method: "DELETE" });
        const j = await r.json();
        if (!r.ok || j?.success === false) { setError(j?.error?.message || "Could not remove that domain."); return; }
        if (expanded === d.id) setExpanded(null);
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
                {summary.primary ? <>Primary: <span className="font-medium text-foreground">{summary.primary}</span></> : "Register a new domain, or connect one you already own."}
              </p>
            </div>
            <button onClick={openAdd} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60">
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

        {/* search & buy */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Wand2 className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold">Find a new domain</h3>
              <p className="text-[11.5px] text-muted-foreground">Search a name and register it instantly.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            <label className="block min-w-[200px] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Name to register</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                placeholder="mybrand"
                className={FIELD}
              />
            </label>
            <button onClick={runSearch} disabled={searching} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
              {searching ? <FlowLoader size={15} tone="white" /> : <Search className="h-3.5 w-3.5" />} Search
            </button>
          </div>
          {searchError && <p className="mt-2 text-[12px] text-rose-500">{searchError}</p>}

          {results && (
            <div className="mt-3 space-y-2">
              {results.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-3.5 py-4 text-center text-[12px] text-muted-foreground">No matches — try another name.</p>
              )}
              {results.map((res) => {
                const full = `${res.domain}.${res.tld}`;
                const isBuying = buying === full;
                return (
                  <div key={full} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/30 p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-brand-500"><Globe className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <span className="truncate text-[13px] font-semibold">{full}</span>
                      <div className="mt-0.5 flex items-center gap-2">
                        {res.available ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500"><Check className="h-3 w-3" /> Available</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><X className="h-3 w-3" /> Taken</span>
                        )}
                        {res.available && (
                          <span className="text-[11px] font-semibold text-foreground">
                            {res.isFreeEligible ? "Free" : `${priceLabel(res.retailCents)}/yr`}
                          </span>
                        )}
                      </div>
                    </div>
                    {res.available && (
                      <button
                        onClick={() => buy(res)}
                        disabled={!!buying || !!registering}
                        className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60"
                      >
                        {isBuying ? <FlowLoader size={13} tone="white" /> : res.isFreeEligible ? <Star className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                        {res.isFreeEligible ? "Claim free" : "Buy"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* inline Stripe payment panel for a paid purchase */}
          {payment && (
            <div className="mt-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-brand-500" />
                <p className="text-[12.5px] font-semibold">Pay &amp; register <span className="text-foreground">{payment.domainName}</span></p>
              </div>
              <Elements stripe={stripePromise} options={{ clientSecret: payment.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#6366f1", borderRadius: "8px" } } }}>
                <PaymentPanel
                  domainName={payment.domainName}
                  onSuccess={() => onPaid(payment.domainName)}
                  onCancel={() => setPayment(null)}
                />
              </Elements>
            </div>
          )}

          {registering && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3.5 py-2.5 text-[12.5px] text-brand-500">
              <FlowLoader size={15} /> Registering {registering}…
            </p>
          )}
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
                const open = expanded === d.id;
                return (
                  <div key={d.id} className="rounded-xl border border-border bg-muted/30">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
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
                          {d.isFree && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-500">Free</span>
                          )}
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

                      {/* primary actions + expander */}
                      <div className="ms-auto flex flex-wrap items-center gap-1.5">
                        <a href={`https://${d.domainName}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" /> Visit
                        </a>
                        <button
                          onClick={() => setExpanded(open ? null : d.id)}
                          aria-expanded={open}
                          className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60", open ? "border-brand-500/60 text-foreground" : "border-border")}
                        >
                          <Settings2 className="h-3.5 w-3.5" /> Manage {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* next-action hint from the API */}
                      {d.nextAction && d.nextAction.priority <= 2 && d.nextAction.type !== "healthy" && (
                        <p className="mt-1 flex w-full items-start gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
                          <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" /> {d.nextAction.description}
                        </p>
                      )}
                    </div>

                    {open && (
                      <DomainManager
                        domain={d}
                        verified={verified}
                        busy={busy}
                        onAct={act}
                        onChanged={load}
                        notify={(m) => { setNotice(m); setError(""); }}
                        fail={(m) => { setError(m); setNotice(""); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet-500/10 text-brand-500"><Globe className="h-6 w-6" /></span>
              <p className="mt-3 text-[13px] font-medium">No custom domains yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Search above to register a brand-new domain, or connect one you already own.</p>
              <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Connect a domain</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------- Stripe payment ------------------------------ */

function PaymentPanel({ domainName, onSuccess, onCancel }: { domainName: string; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true); setErr(null);

    const { error: submitError } = await elements.submit();
    if (submitError) { setErr(submitError.message || "Payment validation failed"); setProcessing(false); return; }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) { setErr(confirmError.message || "Payment failed"); setProcessing(false); }
    else onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={processing} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button type="submit" disabled={!stripe || processing} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
          {processing ? <FlowLoader size={15} tone="white" /> : <CreditCard className="h-3.5 w-3.5" />} Pay &amp; register {domainName}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ Per-domain manager --------------------------- */

type ManagerTab = "dns" | "settings" | "status";

function DomainManager({
  domain, verified, busy, onAct, onChanged, notify, fail,
}: {
  domain: Domain;
  verified: boolean;
  busy: string | null;
  onAct: (d: Domain, action: "primary" | "verify" | "remove" | "retry" | "resend") => void;
  onChanged: () => Promise<void> | void;
  notify: (m: string) => void;
  fail: (m: string) => void;
}) {
  const [tab, setTab] = useState<ManagerTab>("dns");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const tabs: { id: ManagerTab; label: string; icon: ElementType }[] = [
    { id: "dns", label: "DNS", icon: ListTree },
    { id: "settings", label: "Settings", icon: Settings2 },
    { id: "status", label: "Status", icon: ShieldCheck },
  ];

  return (
    <div className="border-t border-border p-3.5 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const TIcon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-semibold", tab === t.id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}
            >
              <TIcon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dns" && <DnsTab domain={domain} fail={fail} />}
      {tab === "settings" && <SettingsTab domain={domain} verified={verified} onChanged={onChanged} notify={notify} fail={fail} />}
      {tab === "status" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {domain.isConnected && !verified && (
            <button onClick={() => onAct(domain, "verify")} disabled={busy === `${domain.id}:verify`} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
              {busy === `${domain.id}:verify` ? <FlowLoader size={13} /> : <BadgeCheck className="h-3.5 w-3.5" />} Verify ownership
            </button>
          )}
          {!domain.isPrimary && (
            <button onClick={() => onAct(domain, "primary")} disabled={busy === `${domain.id}:primary` || !verified} title={verified ? undefined : "Verify ownership before setting primary"} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
              {busy === `${domain.id}:primary` ? <FlowLoader size={13} /> : <Star className="h-3.5 w-3.5" />} Set primary
            </button>
          )}
          {registrationFailedOrPending(domain.registrarStatus) && (
            <button onClick={() => onAct(domain, "retry")} disabled={busy === `${domain.id}:retry`} className="inline-flex items-center gap-1.5 rounded-[9px] border border-amber-500/40 px-2.5 py-1.5 text-[11.5px] font-semibold text-amber-600 hover:border-amber-500/70 dark:text-amber-400 disabled:opacity-60">
              {busy === `${domain.id}:retry` ? <FlowLoader size={13} /> : <RefreshCw className="h-3.5 w-3.5" />} Retry registration
            </button>
          )}
          {registrantActionNeeded(domain) && (
            <button onClick={() => onAct(domain, "resend")} disabled={busy === `${domain.id}:resend`} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
              {busy === `${domain.id}:resend` ? <FlowLoader size={13} /> : <Mail className="h-3.5 w-3.5" />} Resend registrant email
            </button>
          )}
          {!confirmRemove ? (
            <button onClick={() => setConfirmRemove(true)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-rose-500/60 hover:text-rose-500">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-[9px] border border-rose-500/40 bg-rose-500/5 px-2 py-1 text-[11.5px]">
              <span className="font-medium text-rose-500">Remove {domain.domainName}?</span>
              <button onClick={() => onAct(domain, "remove")} disabled={busy === `${domain.id}:remove`} className="inline-flex items-center gap-1 rounded-[7px] bg-rose-500 px-2 py-1 font-semibold text-white disabled:opacity-60">
                {busy === `${domain.id}:remove` ? <FlowLoader size={12} tone="white" /> : <Check className="h-3 w-3" />} Yes
              </button>
              <button onClick={() => setConfirmRemove(false)} className="rounded-[7px] px-1.5 py-1 font-semibold text-muted-foreground hover:text-foreground">No</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DnsTab({ domain, fail }: { domain: Domain; fail: (m: string) => void }) {
  const [records, setRecords] = useState<DnsRecord[] | null>(null);
  const [loadErr, setLoadErr] = useState<string>("");
  const [noZone, setNoZone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [recType, setRecType] = useState<string>("A");
  const [recName, setRecName] = useState("");
  const [recContent, setRecContent] = useState("");
  const [recTtl, setRecTtl] = useState("");
  const [formErr, setFormErr] = useState("");

  const loadRecords = useCallback(async () => {
    setLoadErr(""); setNoZone(false);
    try {
      const j = await fetch(`/api/domains/${domain.id}/dns`).then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.records)) {
        setRecords(j.data.records as DnsRecord[]);
        if (j.data.message && j.data.records.length === 0) setNoZone(true);
      } else {
        setRecords([]);
        setLoadErr(j?.error?.message || "Could not load DNS records.");
      }
    } catch {
      setRecords([]);
      setLoadErr("Could not load DNS records.");
    }
  }, [domain.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const addRecord = async () => {
    if (!recName.trim() || !recContent.trim()) { setFormErr("Name and content are required."); return; }
    setSavingRec(true); setFormErr("");
    try {
      const body: Record<string, unknown> = { type: recType, name: recName.trim(), content: recContent.trim() };
      if (recTtl.trim() && !Number.isNaN(Number(recTtl))) body.ttl = Number(recTtl);
      const r = await fetch(`/api/domains/${domain.id}/dns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j?.success !== false) {
        setRecName(""); setRecContent(""); setRecTtl(""); setRecType("A"); setAdding(false);
        await loadRecords();
      } else {
        setFormErr(j?.error?.message || "Could not add that record.");
      }
    } catch {
      setFormErr("Could not add that record.");
    } finally {
      setSavingRec(false);
    }
  };

  const removeRecord = async (recordId: string) => {
    setDeleting(recordId);
    try {
      const r = await fetch(`/api/domains/${domain.id}/dns`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      const j = await r.json();
      if (r.ok && j?.success !== false) await loadRecords();
      else fail(j?.error?.message || "Could not delete that record.");
    } catch {
      fail("Could not delete that record.");
    } finally {
      setDeleting(null);
    }
  };

  if (records === null) {
    return <div className="grid place-items-center py-6"><FlowLoader size={22} label="Loading DNS records…" /></div>;
  }

  return (
    <div className="space-y-2.5">
      {noZone && (
        <p className="rounded-lg border border-border bg-background px-3 py-2 text-[11.5px] text-muted-foreground">DNS management becomes available once this domain&apos;s zone is provisioned.</p>
      )}
      {loadErr && <p className="text-[12px] text-rose-500">{loadErr}</p>}

      {records.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[70px_1fr_1.5fr_60px_34px] gap-2 bg-muted/50 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Type</span><span>Name</span><span>Content</span><span>TTL</span><span />
          </div>
          {records.map((rec) => (
            <div key={rec.id} className="grid grid-cols-1 items-center gap-1 border-t border-border bg-background px-3 py-2 text-[11.5px] sm:grid-cols-[70px_1fr_1.5fr_60px_34px] sm:gap-2 first:border-t-0">
              <span className="font-semibold text-brand-500">{rec.type}</span>
              <span className="truncate font-medium" title={rec.name}>{rec.name}</span>
              <span className="truncate text-muted-foreground" title={rec.content}>{rec.content}</span>
              <span className="text-muted-foreground">{rec.ttl === 1 ? "Auto" : rec.ttl ?? "—"}</span>
              <button onClick={() => removeRecord(rec.id)} disabled={deleting === rec.id} aria-label="Delete record" className="justify-self-start text-muted-foreground hover:text-rose-500 disabled:opacity-60 sm:justify-self-center">
                {deleting === rec.id ? <FlowLoader size={13} /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {!noZone && (adding ? (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium text-muted-foreground">Type</span>
              <select value={recType} onChange={(e) => setRecType(e.target.value)} className="rounded-[9px] border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-brand-500/60">
                {DNS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block min-w-[120px] flex-1">
              <span className="mb-1 block text-[10.5px] font-medium text-muted-foreground">Name</span>
              <input value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="@ or www" className="w-full rounded-[9px] border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
            </label>
            <label className="block min-w-[140px] flex-1">
              <span className="mb-1 block text-[10.5px] font-medium text-muted-foreground">Content</span>
              <input value={recContent} onChange={(e) => setRecContent(e.target.value)} placeholder="value" className="w-full rounded-[9px] border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
            </label>
            <label className="block w-[70px]">
              <span className="mb-1 block text-[10.5px] font-medium text-muted-foreground">TTL</span>
              <input value={recTtl} onChange={(e) => setRecTtl(e.target.value)} placeholder="Auto" inputMode="numeric" className="w-full rounded-[9px] border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
            </label>
          </div>
          {formErr && <p className="mt-2 text-[11.5px] text-rose-500">{formErr}</p>}
          <div className="mt-2.5 flex gap-2">
            <button onClick={addRecord} disabled={savingRec} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">
              {savingRec ? <FlowLoader size={13} tone="white" /> : <Check className="h-3.5 w-3.5" />} Add record
            </button>
            <button onClick={() => { setAdding(false); setFormErr(""); }} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-dashed border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add record
        </button>
      ))}
    </div>
  );
}

function SettingsTab({
  domain, verified, onChanged, notify, fail,
}: {
  domain: Domain;
  verified: boolean;
  onChanged: () => Promise<void> | void;
  notify: (m: string) => void;
  fail: (m: string) => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const linkedToStore = !!domain.storeId;

  const patch = async (key: string, body: Record<string, unknown>, okMsg?: string) => {
    setBusyKey(key);
    try {
      const r = await fetch(`/api/domains/${domain.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j?.success !== false) {
        if (okMsg || j?.message) notify(okMsg || j.message);
        await onChanged();
      } else {
        fail(j?.error?.message || "Could not update that setting.");
      }
    } catch {
      fail("Could not update that setting.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-2">
      <Toggle
        label="Auto-renew"
        hint="Renew automatically before expiry."
        on={!!domain.autoRenew}
        busy={busyKey === "autoRenew"}
        onToggle={(v) => patch("autoRenew", { autoRenew: v }, `Auto-renew ${v ? "on" : "off"}.`)}
      />
      <Toggle
        label="WHOIS privacy"
        hint="Hide your contact details in the public WHOIS."
        on={!!domain.whoisPrivacy}
        busy={busyKey === "whoisPrivacy"}
        onToggle={(v) => patch("whoisPrivacy", { whoisPrivacy: v }, `WHOIS privacy ${v ? "on" : "off"}.`)}
      />
      <Toggle
        label="Use for my store"
        hint={verified ? "Serve your FlowShop store on this domain." : "Verify ownership first to link your store."}
        icon={Store}
        on={linkedToStore}
        busy={busyKey === "linkToStore"}
        disabled={!verified && !linkedToStore}
        onToggle={(v) => patch("linkToStore", { linkToStore: v })}
      />
    </div>
  );
}

function Toggle({
  label, hint, on, busy, onToggle, disabled, icon: Icon,
}: {
  label: string;
  hint?: string;
  on: boolean;
  busy?: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  icon?: ElementType;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">{Icon && <Icon className="h-3.5 w-3.5 text-brand-500" />}{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && !busy && onToggle(!on)}
        disabled={disabled || busy}
        aria-pressed={on}
        className={cn("relative ms-auto inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50", on ? "bg-brand-500" : "bg-muted")}
      >
        {busy ? (
          <span className="absolute inset-0 grid place-items-center"><FlowLoader size={13} tone={on ? "white" : "brand"} /></span>
        ) : (
          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
        )}
      </button>
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
