"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Plus, X, RefreshCw, Lock, Sparkles, Check, AlertTriangle, Infinity as InfinityIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import { cn } from "@/lib/utils/cn";

/**
 * Connections — a REAL new-design surface to connect/disconnect social accounts
 * inline. No redirect-to-legacy: "Connect" navigates to the platform's official
 * OAuth (/api/social/<platform>/connect) and returns here; "Disconnect" hits
 * DELETE /api/social-accounts/[id]. [[new-design-no-legacy]]
 *
 * Slot awareness: GET /api/social-accounts returns connectionSlots
 * (baseLimit / effectiveLimit / unlockCreditCost / purchasedCredits + per-platform
 * unlocks) plus connectedCount / accountLimit / remainingSlots. When the account is
 * at its connection limit we surface the usage + an at-limit warning, and offer an
 * inline two-step "Unlock a slot" that charges credits via
 * POST /api/social-accounts/unlock and re-fetches. [[agent-operates-account-full-crud]]
 */

interface Account {
  id: string;
  platform: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  needsReconnect?: boolean;
}
interface PlatformUnlock {
  unlockedSlots: number;
  remainingUnlockedSlots: number;
  creditsSpent: number;
}
interface Platform {
  platform: string;
  name?: string;
  connected?: boolean;
  connectedCount?: number;
  accounts?: Account[];
}
interface ConnectionSlots {
  baseLimit: number | null;
  effectiveLimit: number | null;
  totalUnlockedSlots: number;
  unlockCreditCost: number;
  platformUnlocks: Record<string, PlatformUnlock>;
  purchasedCredits: number;
  creditBalance: number;
}

const CONNECTABLE = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "pinterest", "google_business"];
const COLORS: Record<string, string> = {
  instagram: "#E4405F", facebook: "#1877F2", twitter: "#1d9bf0", linkedin: "#0A66C2",
  tiktok: "#111827", youtube: "#FF0000", pinterest: "#E60023", google_business: "#1A73E8",
};
const NAMES: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", twitter: "X / Twitter", linkedin: "LinkedIn",
  tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest", google_business: "Google Business Profile",
};

const DEFAULT_UNLOCK_COST = 250;

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function FocusedConnections({ refreshKey }: { refreshKey?: number }) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [slots, setSlots] = useState<ConnectionSlots | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j.data) {
          if (Array.isArray(j.data.platforms)) setPlatforms(j.data.platforms);
          setConnectedCount(toNum(j.data.connectedCount));
          const cs = j.data.connectionSlots;
          if (cs && typeof cs === "object") {
            setSlots({
              baseLimit: cs.baseLimit ?? null,
              effectiveLimit: cs.effectiveLimit ?? null,
              totalUnlockedSlots: toNum(cs.totalUnlockedSlots),
              unlockCreditCost: toNum(cs.unlockCreditCost, DEFAULT_UNLOCK_COST),
              platformUnlocks: (cs.platformUnlocks && typeof cs.platformUnlocks === "object") ? cs.platformUnlocks : {},
              purchasedCredits: toNum(cs.purchasedCredits),
              creditBalance: toNum(cs.creditBalance),
            });
          } else {
            // Fall back to the flat meta the overview also returns.
            const accountLimit = j.data.accountLimit ?? null;
            setSlots({
              baseLimit: accountLimit,
              effectiveLimit: accountLimit,
              totalUnlockedSlots: 0,
              unlockCreditCost: DEFAULT_UNLOCK_COST,
              platformUnlocks: {},
              purchasedCredits: 0,
              creditBalance: 0,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const connect = (platform: string) => { window.location.href = `/api/social/${platform}/connect`; };
  const disconnect = async (id: string) => {
    setBusy(id);
    setErrorMsg(null);
    try { await fetch(`/api/social-accounts/${id}`, { method: "DELETE" }); load(); } catch { /* ignore */ } finally { setBusy(null); }
  };

  const unlockSlot = async (platform: string) => {
    const key = `unlock:${platform}`;
    setBusy(key);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await fetch("/api/social-accounts/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, quantity: 1 }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.success) {
        setConfirmUnlock(null);
        setNotice(`Unlocked an extra ${NAMES[platform] || platform} connection slot. ${toNum(j.data?.creditsRemaining)} credits left.`);
        load();
      } else if (res.status === 402 || j?.error?.code === "INSUFFICIENT_CREDITS") {
        const required = toNum(j?.error?.creditsRequired, slots?.unlockCreditCost ?? DEFAULT_UNLOCK_COST);
        const available = toNum(j?.error?.creditsAvailable);
        setConfirmUnlock(null);
        setErrorMsg(`Not enough credits to unlock a slot — needs ${required}, you have ${available} purchased. Top up credits in the Credits surface, then try again.`);
      } else {
        setErrorMsg(j?.error?.message || "Couldn't unlock a connection slot. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't unlock a connection slot. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading connections…" /></div>;
  }

  const byKey = new Map(platforms.map((p) => [p.platform, p]));
  const list = CONNECTABLE.map((key) => byKey.get(key) ?? { platform: key, accounts: [] as Account[] });

  const unlimited = slots ? slots.effectiveLimit === null : false;
  const effectiveLimit = slots?.effectiveLimit ?? null;
  const remaining = unlimited || effectiveLimit === null ? null : Math.max(0, effectiveLimit - connectedCount);
  const atLimit = !unlimited && effectiveLimit !== null && connectedCount >= effectiveLimit;
  const unlockCost = slots?.unlockCreditCost ?? DEFAULT_UNLOCK_COST;
  const purchasedCredits = slots?.purchasedCredits ?? 0;
  const canAffordUnlock = purchasedCredits >= unlockCost;
  const usedPct = effectiveLimit && effectiveLimit > 0 ? Math.min(100, Math.round((connectedCount / effectiveLimit) * 100)) : 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: intro + connection-slot usage */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[300px] lg:shrink-0">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">Connect your accounts to publish and cross-post. We use each platform’s official login — you’ll come right back here after authorizing.</p>

        {/* Slot usage / limit awareness */}
        {slots && (
          <div className={cn("rounded-2xl border bg-card p-4", atLimit ? "border-amber-500/40" : "border-border")}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-[13.5px] font-bold">Connection slots</h3>
              {unlimited ? (
                <span className="ms-auto inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-500">
                  <InfinityIcon className="h-3.5 w-3.5" /> Unlimited on your plan
                </span>
              ) : (
                <span className="ms-auto text-[12px] font-semibold tabular-nums text-muted-foreground">
                  <span className={cn(atLimit ? "text-amber-500" : "text-foreground")}>{connectedCount}</span>
                  {" / "}
                  {effectiveLimit}
                  <span className="ms-1 font-medium text-muted-foreground">used</span>
                </span>
              )}
            </div>

            {!unlimited && effectiveLimit !== null && (
              <>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn("h-full rounded-full transition-all", atLimit ? "bg-amber-500" : "bg-gradient-to-r from-brand-500 to-violet-500")}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {remaining === 0
                    ? "No free slots remaining."
                    : <>{remaining} {remaining === 1 ? "slot" : "slots"} free{(slots.totalUnlockedSlots ?? 0) > 0 ? ` · ${slots.totalUnlockedSlots} unlocked with credits` : ""}.</>}
                </p>
              </>
            )}

            {atLimit && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                    You’ve reached your plan’s connection limit. Disconnect an account to free a slot, or unlock an extra slot for a platform below with credits ({unlockCost} credits each).
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </aside>

        {/* RIGHT: connect feedback + the platform grid (full width) */}
        <div className="min-w-0 flex-1 space-y-4">
        {/* Mutation feedback */}
        {notice && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[12px] text-emerald-700 dark:text-emerald-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 text-emerald-600/70 hover:text-emerald-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} aria-label="Dismiss" className="shrink-0 text-rose-600/70 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
          {list.map((p) => {
            const accounts = p.accounts ?? [];
            const meta = PLATFORM_META[p.platform];
            const PIcon = meta?.icon ?? Plus;
            const color = meta?.color ?? COLORS[p.platform] ?? "#0ea5e9";
            const unlockKey = `unlock:${p.platform}`;
            const isUnlocking = busy === unlockKey;
            const showUnlock = atLimit; // only when no free slot remains
            const platformUnlocked = slots?.platformUnlocks?.[p.platform]?.unlockedSlots ?? 0;
            return (
              <div key={p.platform} className="min-w-0 rounded-2xl border border-border bg-card p-4">
                <div className="flex min-w-0 flex-wrap items-start gap-2.5">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", meta?.bgClass ?? "bg-muted")} style={{ color }}><PIcon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-[14px] font-bold leading-tight">{meta?.label || p.name || NAMES[p.platform] || p.platform}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {platformUnlocked > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-amber-600 dark:text-amber-400">
                          <Sparkles className="h-2.5 w-2.5" /> {platformUnlocked} unlocked
                        </span>
                      )}
                      {accounts.length > 0 && <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-emerald-500">{accounts.length} connected</span>}
                    </div>
                  </div>
                </div>

                {accounts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {accounts.map((a) => (
                      <div key={a.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/30 px-2.5 py-2">
                        {a.avatarUrl ? (
                          <Image src={a.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" unoptimized />
                        ) : (
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{(a.displayName || a.username || "?").slice(0, 1).toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium">{a.displayName || a.username || "Account"}</p>
                          {a.username && <p className="truncate text-[11px] text-muted-foreground">@{a.username}</p>}
                        </div>
                        <div className="ms-auto flex shrink-0 items-center gap-1">
                          {a.needsReconnect && (
                            <button onClick={() => connect(p.platform)} title="Reconnect account" className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-semibold text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                              <RefreshCw className="h-3 w-3" />
                              <span className="hidden 2xl:inline">Reconnect</span>
                            </button>
                          )}
                          <button onClick={() => disconnect(a.id)} disabled={busy === a.id} aria-label="Disconnect" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                            {busy === a.id ? <FlowLoader size={12} /> : <X className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showUnlock ? (
                  <div className="mt-3 space-y-2">
                    {confirmUnlock === p.platform ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                        <p className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300">
                          Unlock 1 extra {p.name || NAMES[p.platform] || p.platform} slot for <span className="font-bold">{unlockCost} credits</span>?
                          {canAffordUnlock
                            ? ` You have ${purchasedCredits} purchased credits.`
                            : ` You only have ${purchasedCredits} purchased credits.`}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11.5px]">
                          <button
                            onClick={() => unlockSlot(p.platform)}
                            disabled={isUnlocking || !canAffordUnlock}
                            className="inline-flex items-center gap-1 rounded-[8px] bg-amber-500 px-2.5 py-1 font-semibold text-white disabled:opacity-50"
                          >
                            {isUnlocking ? <FlowLoader size={12} tone="white" /> : <Check className="h-3.5 w-3.5" />} Confirm · {unlockCost}cr
                          </button>
                          <button onClick={() => setConfirmUnlock(null)} className="rounded-[8px] px-2 py-1 font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
                        </div>
                        {!canAffordUnlock && (
                          <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">Top up credits in the Credits surface to unlock.</p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setConfirmUnlock(p.platform); setErrorMsg(null); setNotice(null); }}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-[12.5px] font-semibold text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Unlock a slot · {unlockCost}cr
                      </button>
                    )}
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> At your plan limit — unlock to add another here.
                    </p>
                  </div>
                ) : (
                  <button onClick={() => connect(p.platform)} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" /> {accounts.length > 0 ? "Add another" : "Connect"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
