"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Landmark, Check, AlertCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { FIELD, LABEL, SectionCard, StatTile, money } from "./store-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Payments & payouts — earnings (from /earnings, works without Stripe), payout
 * balance + history and Stripe Connect status (/payouts, /stripe-connect). When
 * payouts aren't set up, a real in-app onboarding flow (create account → identity
 * + bank) via /stripe-connect + /stripe-connect/complete. No legacy links.
 */

interface Lifetime { revenueCents?: number; platformFeesCents?: number; netCents?: number; orderCount?: number; }
interface Payout { id: string; amountCents?: number; netCents?: number; status?: string; arrivalDate?: string | null; createdAt?: string; }

export function StorePayments({ currency }: { currency: string }) {
  const [loading, setLoading] = useState(true);
  const [lifetime, setLifetime] = useState<Lifetime>({});
  const [platformFeePercent, setPlatformFeePercent] = useState(3);
  const [connected, setConnected] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [balance, setBalance] = useState<{ available: number; pending: number }>({ available: 0, pending: 0 });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const cur = currency || "USD";

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      fetch("/api/ecommerce/earnings").then((r) => r.json()).catch(() => null),
      fetch("/api/ecommerce/payouts").then((r) => r.json()).catch(() => null),
    ]);
    const ed = e?.data;
    if (ed) { setLifetime(ed.lifetime || {}); if (ed.store?.platformFeePercent != null) setPlatformFeePercent(ed.store.platformFeePercent); setConnected(!!ed.store?.stripeConnectAccountId); setOnboardingComplete(!!ed.store?.stripeOnboardingComplete); }
    const pd = p?.data;
    if (pd) { setPayouts(Array.isArray(pd.payouts) ? pd.payouts : []); if (pd.balance) setBalance(pd.balance); if (pd.onboardingComplete != null) setOnboardingComplete(!!pd.onboardingComplete); }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  if (loading) return <SectionCard><div className="grid place-items-center py-12"><FlowLoader size={24} label="Loading payouts…" /></div></SectionCard>;

  return (
    <div className="space-y-4">
      {onboardingComplete ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-[12.5px] text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4 shrink-0" /><p className="flex-1 font-medium">Payouts are set up. Charges &amp; transfers are enabled.</p><button onClick={() => openDashboard()} className="inline-flex items-center gap-1 text-[11.5px] font-semibold hover:underline">Stripe dashboard <ExternalLink className="h-3 w-3" /></button></div>
      ) : (
        <ConnectPayouts onDone={load} />
      )}

      <SectionCard icon={Coins} title="Earnings" hint={`Lifetime, after FlowSmartly's ${platformFeePercent}% platform fee.`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Gross revenue" value={money(lifetime.revenueCents, cur)} />
          <StatTile label="Platform fees" value={money(lifetime.platformFeesCents, cur)} />
          <StatTile label="Net earnings" value={money(lifetime.netCents, cur)} />
          <StatTile label="Paid orders" value={String(lifetime.orderCount ?? 0)} />
        </div>
      </SectionCard>

      {onboardingComplete && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard icon={Landmark} title="Balance">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Available" value={money(balance.available, cur)} />
              <StatTile label="Pending" value={money(balance.pending, cur)} />
            </div>
          </SectionCard>
          <SectionCard title="Recent payouts">
            {payouts.length ? (
              <table className="w-full text-[12.5px]">
                <tbody>{payouts.slice(0, 6).map((po) => (
                  <tr key={po.id} className="border-t border-border first:border-t-0">
                    <td className="py-2 text-muted-foreground">{fmt(po.arrivalDate || po.createdAt)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{money(po.netCents ?? po.amountCents, cur)}</td>
                    <td className="py-2 pl-3 text-right"><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", po.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : po.status === "failed" ? "bg-rose-500/10 text-rose-500" : "bg-brand-500/10 text-brand-500")}>{(po.status || "pending").replace(/_/g, " ")}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <p className="text-[12px] text-muted-foreground">No payouts yet — they appear here after your first sales settle.</p>}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

async function openDashboard() {
  try {
    const r = await fetch("/api/ecommerce/stripe-connect/login-link", { method: "POST" });
    const j = await r.json().catch(() => null);
    if (j?.url) window.open(j.url, "_blank", "noopener");
  } catch { /* ignore */ }
}

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return "—"; }
}

/** Create the Connect account, then collect identity + bank to finish onboarding. */
function ConnectPayouts({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"intro" | "form">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({ accountHolderName: "", day: "", month: "", year: "", ssnLast4: "", bankRouting: "", bankAccount: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const start = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/ecommerce/stripe-connect", { method: "POST" });
      if (r.ok) setStep("form");
      else { const j = await r.json().catch(() => null); setError(j?.error?.message || j?.error || "Couldn't start payout setup."); }
    } catch { setError("Couldn't start payout setup."); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/ecommerce/stripe-connect/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountHolderName: f.accountHolderName.trim(), dob: { day: Number(f.day), month: Number(f.month), year: Number(f.year) }, ssnLast4: f.ssnLast4.trim(), bankRouting: f.bankRouting.trim(), bankAccount: f.bankAccount.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.onboardingComplete) onDone();
      else setError(j?.error?.message || j?.error || "Couldn't complete setup — check the details and try again.");
    } catch { setError("Couldn't complete setup."); }
    finally { setBusy(false); }
  };

  return (
    <SectionCard icon={Landmark} title="Set up payouts" hint="Connect a bank account to get paid. Powered by Stripe — your details are sent securely and never stored by us.">
      {step === "intro" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={start} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{busy ? <FlowLoader size={14} tone="white" /> : <Landmark className="h-4 w-4" />} Set up payouts</button>
          <span className="text-[11.5px] text-muted-foreground">Takes ~2 minutes · identity + bank details.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block"><span className={LABEL}>Account holder name</span><input value={f.accountHolderName} onChange={(e) => set("accountHolderName", e.target.value)} placeholder="Full legal name" className={FIELD} /></label>
          <div>
            <span className={LABEL}>Date of birth</span>
            <div className="grid grid-cols-3 gap-2.5">
              <input value={f.month} onChange={(e) => set("month", e.target.value)} inputMode="numeric" placeholder="MM" className={FIELD} />
              <input value={f.day} onChange={(e) => set("day", e.target.value)} inputMode="numeric" placeholder="DD" className={FIELD} />
              <input value={f.year} onChange={(e) => set("year", e.target.value)} inputMode="numeric" placeholder="YYYY" className={FIELD} />
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <label className="block"><span className={LABEL}>SSN (last 4)</span><input value={f.ssnLast4} onChange={(e) => set("ssnLast4", e.target.value)} inputMode="numeric" maxLength={4} placeholder="1234" className={FIELD} /></label>
            <label className="block"><span className={LABEL}>Bank routing</span><input value={f.bankRouting} onChange={(e) => set("bankRouting", e.target.value)} inputMode="numeric" placeholder="9 digits" className={FIELD} /></label>
            <label className="block"><span className={LABEL}>Account number</span><input value={f.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} inputMode="numeric" placeholder="Account #" className={FIELD} /></label>
          </div>
          <button onClick={complete} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{busy ? <FlowLoader size={14} tone="white" /> : <Check className="h-4 w-4" />} Finish setup</button>
        </div>
      )}
      {error && <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-rose-500"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
    </SectionCard>
  );
}
