"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Gift, Users, UserCheck, Coins, Copy, Check, Link2, Share2, Clock, Mail, MessageCircle, Twitter, Receipt, ChevronDown, Briefcase, UserRound } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Referrals — a deep new-design surface (the referral workspace canvas): the
 * user's personal referral link + code with a one-tap copy, headline KPIs
 * (referred, converted, earned), and the list of people they brought in. Real
 * data (GET /api/referrals). Copy-to-share is the core action and it happens
 * right here in the UI — no chat prompt, no legacy links. [[new-design-no-legacy]]
 */

interface Stats {
  totalReferrals?: number;
  activeReferrals?: number;
  totalEarnedCents?: number;
  pendingCommissionsCents?: number;
}

interface ReferredUser {
  id: string;
  referredName?: string | null;
  referredEmail?: string | null;
  referredAvatar?: string | null;
  referralType?: string;
  status?: string;
  commissionRate?: number;
  commissionType?: string;
  expiresAt?: string | null;
  totalEarnedCents?: number;
  createdAt?: string;
}

interface Commission {
  id: string;
  amountCents?: number;
  amount?: number;
  status?: string;
  description?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  referredName?: string | null;
  createdAt?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
  total?: number;
  pages?: number;
}

const PAGE_LIMIT = 20;

/** "Client" (referred a client) vs "Agent" (referred another agent). [[legacy /referrals parity]] */
function referralTypeLabel(type?: string): { label: string; icon: ElementType; tone: string } {
  switch ((type || "").toUpperCase()) {
    case "AGENT_TO_AGENT":
      return { label: "Agent", icon: Briefcase, tone: "bg-violet-500/10 text-violet-500" };
    case "USER_TO_CLIENT":
    case "AGENT_TO_CLIENT":
      return { label: "Client", icon: UserRound, tone: "bg-blue-500/10 text-blue-500" };
    default:
      return { label: "Client", icon: UserRound, tone: "bg-blue-500/10 text-blue-500" };
  }
}

/** Per-referral commission rate + type, e.g. "5% recurring" / "50% one-time". */
function commissionLabel(rate?: number, type?: string): string {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return "";
  const pct = (rate * 100).toFixed(0);
  const kind = (type || "").toUpperCase() === "ONE_TIME" ? "one-time" : "recurring";
  return `${pct}% ${kind}`;
}

/** Human label for a commission's sourceType (SUBSCRIPTION / CREDIT_PURCHASE / AGENT_HIRE). */
function sourceTypeLabel(sourceType?: string | null): string {
  switch ((sourceType || "").toUpperCase()) {
    case "SUBSCRIPTION":
      return "Subscription";
    case "CREDIT_PURCHASE":
      return "Credit purchase";
    case "AGENT_HIRE":
      return "Agent hire";
    default:
      return "";
  }
}

function money(cents?: number): string {
  const v = (cents ?? 0) / 100;
  try {
    return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: v % 1 === 0 ? 0 : 2 });
  } catch {
    return `$${v.toFixed(0)}`;
  }
}

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function FocusedReferrals({ refreshKey }: { refreshKey?: number }) {
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [stats, setStats] = useState<Stats>({});
  const [referrals, setReferrals] = useState<ReferredUser[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [pagination, setPagination] = useState<Pagination>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  // Load one page of referrals. page 1 = fresh load (also seeds commissions);
  // page > 1 appends to the existing list (the route paginates the referral
  // list via ?page/limit). [[GET /api/referrals?page&limit]]
  const load = useCallback(async (page: number) => {
    const j = await fetch(`/api/referrals?page=${page}&limit=${PAGE_LIMIT}`).then((r) => r.json());
    if (j?.success && j.data) {
      setCode(typeof j.data.code === "string" ? j.data.code : "");
      setLink(typeof j.data.link === "string" ? j.data.link : "");
      if (j.data.stats) setStats(j.data.stats as Stats);
      if (j.data.pagination) setPagination(j.data.pagination as Pagination);
      const next = Array.isArray(j.data.referrals) ? (j.data.referrals as ReferredUser[]) : [];
      setReferrals((prev) => {
        if (page <= 1) return next;
        // De-dupe by id when appending (defensive against overlap).
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...next.filter((r) => !seen.has(r.id))];
      });
      // Commission history is tied to the same page param, so we only seed it
      // from page 1 to keep the full first-page history stable while paging.
      if (page <= 1 && Array.isArray(j.data.commissions)) setCommissions(j.data.commissions as Commission[]);
      setError("");
    } else {
      setError(j?.error?.message || "Could not load your referrals.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load(1).catch(() => { if (alive) setError("Could not load your referrals."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const loadedPage = pagination.page ?? 1;
  const totalPages = pagination.pages ?? 1;
  const hasMore = loadedPage < totalPages;
  const totalReferralsCount = pagination.total ?? referrals.length;

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await load(loadedPage + 1);
    } catch {
      setError("Could not load more referrals.");
    } finally {
      setLoadingMore(false);
    }
  };

  const copy = async (value: string, which: "link" | "code") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for browsers / contexts without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 1800);
  };

  // One-tap share to X / WhatsApp / Email — external share intents (allowed).
  const share = (network: "x" | "whatsapp" | "email") => {
    if (!link) return;
    const text = "I use FlowSmartly to run my marketing — join with my link and we both earn:";
    const url =
      network === "x"
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
        : network === "whatsapp"
          ? `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`
          : `mailto:?subject=${encodeURIComponent("Join me on FlowSmartly")}&body=${encodeURIComponent(`${text}\n\n${link}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your referrals…" /></div>;
  }

  const referred = stats.totalReferrals ?? referrals.length;
  const converted = stats.activeReferrals ?? referrals.filter((r) => (r.status || "").toUpperCase() === "ACTIVE").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* hero — link + code with copy */}
        <section className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-violet-500/20 text-brand-500"><Gift className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-muted-foreground">Your referral program</p>
              <h2 className="text-[20px] font-extrabold leading-tight">Invite friends, earn together</h2>
            </div>
            {stats.pendingCommissionsCents ? (
              <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[12px] font-semibold"><Clock className="h-3.5 w-3.5 text-amber-500" /> {money(stats.pendingCommissionsCents)} pending</span>
            ) : null}
          </div>

          {error && !link && !code ? (
            <p className="mt-4 rounded-xl border border-dashed border-border bg-background/40 px-4 py-3 text-[12.5px] text-muted-foreground">{error}</p>
          ) : (
            <>
              {/* referral link */}
              <div className="mt-4">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Your referral link</span>
                <div className="flex items-stretch gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-background/70 px-3 py-2.5">
                    <Link2 className="h-4 w-4 shrink-0 text-brand-500" />
                    <span className="truncate text-[13px] font-medium">{link || "—"}</span>
                  </div>
                  <button
                    onClick={() => copy(link, "link")}
                    disabled={!link}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60"
                  >
                    {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "link" ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>

              {/* referral code */}
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Or share your code</span>
                  <button
                    onClick={() => copy(code, "code")}
                    disabled={!code}
                    className="group inline-flex items-center gap-2 rounded-[10px] border border-border bg-background/70 px-3 py-2 text-[14px] font-bold tracking-wide hover:border-brand-500/60 disabled:opacity-60"
                  >
                    <Share2 className="h-3.5 w-3.5 text-brand-500" />
                    {code || "—"}
                    <span className="text-muted-foreground transition group-hover:text-foreground">{copied === "code" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</span>
                  </button>
                </div>
                <p className="text-[12px] leading-snug text-muted-foreground">When someone signs up with your link, you earn a recurring commission on their spend.</p>
              </div>

              {/* one-tap share */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Share:</span>
                <button onClick={() => share("x")} disabled={!link} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background/70 px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"><Twitter className="h-3.5 w-3.5" /> X</button>
                <button onClick={() => share("whatsapp")} disabled={!link} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background/70 px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                <button onClick={() => share("email")} disabled={!link} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background/70 px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"><Mail className="h-3.5 w-3.5" /> Email</button>
              </div>
            </>
          )}
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={Users} tone="text-brand-500" label="Referred" value={referred.toLocaleString()} />
          <Kpi icon={UserCheck} tone="text-emerald-500" label="Converted" value={converted.toLocaleString()} />
          <Kpi icon={Coins} tone="text-amber-500" label="Earned" value={money(stats.totalEarnedCents)} />
        </div>

        {/* referred users */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold">People you referred</h3>
            {referrals.length ? (
              <span className="shrink-0 text-[11.5px] font-medium text-muted-foreground tabular-nums">
                {totalReferralsCount > referrals.length ? `${referrals.length} of ${totalReferralsCount.toLocaleString()}` : totalReferralsCount.toLocaleString()}
              </span>
            ) : null}
          </div>
          {referrals.length ? (
            <>
              <div className="space-y-2">
                {referrals.map((r) => {
                  const active = (r.status || "").toUpperCase() === "ACTIVE";
                  const name = r.referredName || r.referredEmail || "New member";
                  const type = referralTypeLabel(r.referralType);
                  const TypeIcon = type.icon;
                  const rate = commissionLabel(r.commissionRate, r.commissionType);
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                      {r.referredAvatar ? (
                        <Image src={r.referredAvatar} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" unoptimized />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/30 text-[11px] font-bold text-brand-500">{name.slice(0, 1).toUpperCase()}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-[13px] font-medium">{name}</p>
                          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", type.tone)}>
                            <TypeIcon className="h-2.5 w-2.5" />{type.label}
                          </span>
                        </div>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {r.createdAt ? `Joined ${whenLabel(r.createdAt)}` : (r.referredEmail || "")}
                          {rate ? <span className="text-foreground/70"> · {rate}</span> : null}
                        </p>
                      </div>
                      {r.totalEarnedCents ? <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-emerald-500">+{money(r.totalEarnedCents)}</span> : null}
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{(r.status || "active").toLowerCase()}</span>
                    </div>
                  );
                })}
              </div>
              {hasMore ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-background/70 px-4 py-2 text-[12.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground disabled:opacity-60"
                >
                  {loadingMore ? (
                    <FlowLoader size={16} />
                  ) : (
                    <><ChevronDown className="h-4 w-4" /> Load more ({(totalReferralsCount - referrals.length).toLocaleString()} more)</>
                  )}
                </button>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><Gift className="h-5 w-5" /></span>
              <p className="mt-3 text-[13px] font-medium">No referrals yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Copy your link above and share it — the people who sign up will show up here.</p>
              <button
                onClick={() => copy(link, "link")}
                disabled={!link}
                className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60"
              >
                {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "link" ? "Copied" : "Copy my link"}
              </button>
            </div>
          )}
        </section>

        {/* commission history */}
        {commissions.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-brand-500" />
              <h3 className="text-[13px] font-bold">Commission history</h3>
            </div>
            <div className="space-y-1.5">
              {commissions.map((c) => {
                const cents = typeof c.amountCents === "number" ? c.amountCents : typeof c.amount === "number" ? Math.round(c.amount * 100) : 0;
                const st = (c.status || "pending").toLowerCase();
                const paid = st === "paid" || st === "completed";
                const title = c.description || c.sourceName || c.referredName || "Referral commission";
                const source = sourceTypeLabel(c.sourceType);
                const sub = [c.createdAt ? whenLabel(c.createdAt) : "", source].filter(Boolean).join(" · ");
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", paid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}><Coins className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-emerald-500">+{money(cents)}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", paid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>{st}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className={cn("flex items-center gap-2", tone)}>
        <Icon className="h-4 w-4" />
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
