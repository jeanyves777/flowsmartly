"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Gift, Users, UserCheck, Coins, Copy, Check, Link2, Share2, Clock } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/referrals?limit=30").then((r) => r.json());
      if (j?.success && j.data) {
        setCode(typeof j.data.code === "string" ? j.data.code : "");
        setLink(typeof j.data.link === "string" ? j.data.link : "");
        if (j.data.stats) setStats(j.data.stats as Stats);
        if (Array.isArray(j.data.referrals)) setReferrals(j.data.referrals as ReferredUser[]);
        setError("");
      } else {
        setError(j?.error?.message || "Could not load your referrals.");
      }
    } catch {
      setError("Could not load your referrals.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

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
          <h3 className="mb-3 text-[13px] font-bold">People you referred</h3>
          {referrals.length ? (
            <div className="space-y-2">
              {referrals.map((r) => {
                const active = (r.status || "").toUpperCase() === "ACTIVE";
                const name = r.referredName || r.referredEmail || "New member";
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    {r.referredAvatar ? (
                      <Image src={r.referredAvatar} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" unoptimized />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/30 text-[11px] font-bold text-brand-500">{name.slice(0, 1).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{name}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{r.createdAt ? `Joined ${whenLabel(r.createdAt)}` : (r.referredEmail || "")}</p>
                    </div>
                    {r.totalEarnedCents ? <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-emerald-500">+{money(r.totalEarnedCents)}</span> : null}
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{(r.status || "active").toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
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
