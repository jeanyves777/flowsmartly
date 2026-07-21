"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Landmark, Check, AlertCircle, ExternalLink, ShieldCheck, CreditCard, Clock, Banknote } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { FIELD, LABEL, SectionCard, StatTile, Toggle, money } from "./store-ui";
import { cn } from "@/lib/utils/cn";
import { getCountryName } from "@/lib/constants/regions";
import {
  getPayoutConfig,
  bankFieldsFor,
  personalIdFieldFor,
  cleanFieldValue,
  humanizeRequirements,
  type BankFieldSpec,
} from "@/lib/store/payout-countries";

/**
 * Payments & payouts. Payments are Stripe-only (cards) for now, so the
 * "Accepted methods" card honestly reflects that + whether it's live yet.
 *
 * Payouts are Stripe Connect *Custom* accounts, collected country-aware: an
 * in-app bank form for the families we can validate (US/UK/CA/AU/IBAN), Stripe's
 * hosted onboarding for other supported countries + business accounts + finishing
 * leftover requirements, and an honest "not available yet" for the rest.
 */

interface Lifetime { revenueCents?: number; platformFeesCents?: number; netCents?: number; orderCount?: number; }
interface Payout { id: string; amountCents?: number; netCents?: number; status?: string; arrivalDate?: string | null; createdAt?: string; }

export function StorePayments({ currency, country }: { currency: string; country?: string }) {
  const [loading, setLoading] = useState(true);
  const [lifetime, setLifetime] = useState<Lifetime>({});
  const [platformFeePercent, setPlatformFeePercent] = useState(3);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [balance, setBalance] = useState<{ available: number; pending: number }>({ available: 0, pending: 0 });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const cur = currency || "USD";
  const payoutCfg = getPayoutConfig(country);

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      fetch("/api/ecommerce/earnings").then((r) => r.json()).catch(() => null),
      fetch("/api/ecommerce/payouts").then((r) => r.json()).catch(() => null),
    ]);
    const ed = e?.data;
    if (ed) { setLifetime(ed.lifetime || {}); if (ed.store?.platformFeePercent != null) setPlatformFeePercent(ed.store.platformFeePercent); setOnboardingComplete(!!ed.store?.stripeOnboardingComplete); }
    const pd = p?.data;
    if (pd) { setPayouts(Array.isArray(pd.payouts) ? pd.payouts : []); if (pd.balance) setBalance(pd.balance); if (pd.onboardingComplete != null) setOnboardingComplete(!!pd.onboardingComplete); }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  if (loading) return <SectionCard><div className="grid place-items-center py-12"><FlowLoader size={24} label="Loading payouts…" /></div></SectionCard>;

  return (
    <div className="space-y-4">
      <AcceptedMethods country={country} onboardingComplete={onboardingComplete} supported={!!payoutCfg} />

      {onboardingComplete ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-[12.5px] text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4 shrink-0" /><p className="flex-1 font-medium">Payouts are set up. Charges &amp; transfers are enabled.</p><button onClick={openManage} className="inline-flex items-center gap-1 text-[11.5px] font-semibold hover:underline">Manage payout details <ExternalLink className="h-3 w-3" /></button></div>
      ) : (
        <ConnectPayouts country={country} onDone={load} />
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

/**
 * What buyers can pay with at checkout. Cards run through Stripe (live once
 * payouts are set up); Cash on delivery is a real toggle backed by a
 * StorePaymentMethod row that the storefront's /checkout/options reads live — so
 * it takes effect immediately, no rebuild. It's recommended by region (Africa,
 * the Caribbean, cash-heavy markets) but can be turned on anywhere.
 */
function AcceptedMethods({ country, onboardingComplete, supported }: { country?: string; onboardingComplete: boolean; supported: boolean }) {
  const [cod, setCod] = useState(false);
  const [codRecommended, setCodRecommended] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/ecommerce/payment-methods").then((r) => r.json()).then((j) => {
      if (!alive) return;
      const d = j?.data;
      if (d) { setCod(!!d.codEnabled); setCodRecommended(!!d.codRecommended); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const toggleCod = async () => {
    const next = !cod;
    setCod(next); setSaving(true);
    try {
      await fetch("/api/ecommerce/payment-methods", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cod: next }) });
    } catch { setCod(!next); } // revert on failure
    finally { setSaving(false); }
  };

  const card: { tone: "ok" | "wait" | "off"; label: string; sub: string } = !supported
    ? { tone: "off", label: "Not available yet", sub: `Card payments aren't supported in ${getCountryName(country || "") || "your country"} yet — use Cash on delivery below.` }
    : onboardingComplete
      ? { tone: "ok", label: "Active", sub: "Visa, Mastercard, Amex and wallets — buyers pay securely at checkout." }
      : { tone: "wait", label: "Set up payouts to go live", sub: "Finish payout setup below to start accepting card payments." };
  const cardTone = card.tone === "ok" ? "text-emerald-500" : card.tone === "wait" ? "text-amber-500" : "text-muted-foreground";
  const cardDot = card.tone === "ok" ? "bg-emerald-500" : card.tone === "wait" ? "bg-amber-500" : "bg-muted-foreground/50";

  return (
    <SectionCard icon={CreditCard} title="Accepted payment methods" hint="How buyers pay you at checkout." right={saving ? <FlowLoader size={14} /> : null}>
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/15 to-violet-500/15"><CreditCard className="h-[18px] w-[18px] text-brand-500" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Card payments</p>
            <p className="text-[11.5px] text-muted-foreground">{card.sub}</p>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-semibold", cardTone)}><span className={cn("h-1.5 w-1.5 rounded-full", cardDot)} /> {card.label}</span>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15"><Banknote className="h-[18px] w-[18px] text-emerald-500" /></div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">Cash on delivery {codRecommended && !cod ? <span className="rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-500">Popular in your region</span> : null}</p>
            <p className="text-[11.5px] text-muted-foreground">{cod ? "Buyers can place orders and pay in cash on delivery — tracked in Delivery." : "Let buyers pay in cash on delivery — great where cards aren't common."} Set a limit &amp; handling fee in Settings → Checkout.</p>
          </div>
          <Toggle on={cod} onClick={toggleCod} />
        </div>
      </div>
    </SectionCard>
  );
}

async function openManage() {
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

// ── Country-aware payout onboarding ──

type Step = "intro" | "form" | "pending";
type BizType = "individual" | "company";

function ConnectPayouts({ country, onDone }: { country?: string; onDone: () => void }) {
  const cfg = getPayoutConfig(country);
  const bankFields = bankFieldsFor(country);
  const idField = personalIdFieldFor(country);
  const inApp = !!cfg && cfg.family !== "hosted";

  const [step, setStep] = useState<Step>("intro");
  const [bizType, setBizType] = useState<BizType>("individual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);

  const [accountHolderName, setAccountHolderName] = useState("");
  const [dob, setDob] = useState({ day: "", month: "", year: "" });
  const [personalId, setPersonalId] = useState("");
  const [bank, setBank] = useState<Record<string, string>>({});

  // Re-entry: if an account already exists with pending requirements, show them.
  useEffect(() => {
    if (!inApp) return;
    let alive = true;
    fetch("/api/ecommerce/stripe-connect").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!alive || !j?.connected || j.onboardingComplete) return;
      const reqs: string[] = Array.isArray(j.requirements) ? j.requirements : [];
      if (reqs.length) { setPending(humanizeRequirements(reqs)); setStep("pending"); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [inApp]);

  // Unsupported country → honest COD-style message, no broken form.
  if (!cfg) {
    return (
      <SectionCard icon={Landmark} title="Payouts">
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-[12.5px]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-muted-foreground">Online payouts aren&apos;t available in <span className="font-semibold text-foreground">{getCountryName(country || "") || "your country"}</span> yet. We&apos;re expanding to more regions — you&apos;ll be able to connect a bank here as soon as it&apos;s supported.</p>
        </div>
      </SectionCard>
    );
  }

  const startInApp = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/ecommerce/stripe-connect", { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setError(friendly(j?.error) || "Couldn't start payout setup."); return; }
      setStep("form");
    } catch { setError("Couldn't start payout setup."); }
    finally { setBusy(false); }
  };

  const startHosted = async () => {
    setBusy(true); setError("");
    try {
      const cr = await fetch("/api/ecommerce/stripe-connect", { method: "POST" });
      if (!cr.ok) { const j = await cr.json().catch(() => null); setError(friendly(j?.error) || "Couldn't start setup."); return; }
      const lr = await fetch("/api/ecommerce/stripe-connect/onboarding-link", { method: "POST" });
      const lj = await lr.json().catch(() => null);
      if (lj?.url) { window.location.href = lj.url; return; }
      setError(friendly(lj?.error) || "Couldn't open secure setup.");
    } catch { setError("Couldn't start setup."); }
    finally { setBusy(false); }
  };

  const finishOnStripe = async () => {
    setBusy(true); setError("");
    try {
      const lr = await fetch("/api/ecommerce/stripe-connect/onboarding-link", { method: "POST" });
      const lj = await lr.json().catch(() => null);
      if (lj?.url) { window.location.href = lj.url; return; }
      setError(friendly(lj?.error) || "Couldn't open secure setup.");
    } catch { setError("Couldn't open secure setup."); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    // Client-side validation against the shared field specs.
    if (accountHolderName.trim().length < 2) { setError("Enter the account holder's full name."); return; }
    const d = Number(dob.day), m = Number(dob.month), y = Number(dob.year);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2010)) { setError("Enter a valid date of birth."); return; }
    if (idField) {
      const v = cleanFieldValue(idField, personalId);
      if (!new RegExp(idField.pattern).test(v)) { setError(`Check your ${idField.label.toLowerCase()}.`); return; }
    }
    for (const spec of bankFields) {
      const v = cleanFieldValue(spec, bank[spec.key] || "");
      if (!new RegExp(spec.pattern).test(v)) { setError(`Check your ${spec.label.toLowerCase()}.`); return; }
    }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/ecommerce/stripe-connect/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountHolderName: accountHolderName.trim(), dob: { day: d, month: m, year: y }, personalId: personalId.trim() || undefined, bank }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.onboardingComplete) { onDone(); return; }
      if (r.ok && Array.isArray(j?.requirementLabels) && j.requirementLabels.length) {
        setPending(j.requirementLabels); setStep("pending"); return;
      }
      if (r.ok) { onDone(); return; } // succeeded, nothing left to collect
      setError(friendly(j?.error) || "Couldn't complete setup — check the details and try again.");
    } catch { setError("Couldn't complete setup."); }
    finally { setBusy(false); }
  };

  const primaryStart = inApp && bizType === "individual" ? startInApp : startHosted;

  return (
    <SectionCard icon={Landmark} title="Set up payouts" hint={`Connect a bank account in ${cfg.name} to get paid. Powered by Stripe — your details are sent securely and never stored by us.`}>
      {step === "intro" && (
        <div className="space-y-3">
          <div>
            <span className={LABEL}>Account type</span>
            <div className="mt-1 inline-flex rounded-[10px] border border-border p-0.5">
              {(["individual", "company"] as BizType[]).map((t) => (
                <button key={t} onClick={() => setBizType(t)} className={cn("rounded-[8px] px-3.5 py-1.5 text-[12px] font-semibold capitalize transition", bizType === t ? "bg-brand-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t === "individual" ? "Individual" : "Business"}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={primaryStart} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{busy ? <FlowLoader size={14} tone="white" /> : <Landmark className="h-4 w-4" />} Set up payouts</button>
            <span className="text-[11.5px] text-muted-foreground">{inApp && bizType === "individual" ? "Takes ~2 minutes · identity + bank details." : "Continues on Stripe's secure page."}</span>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="space-y-3">
          <label className="block"><span className={LABEL}>Account holder name</span><input value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Full legal name" className={FIELD} /></label>
          <div>
            <span className={LABEL}>Date of birth</span>
            <div className="grid grid-cols-3 gap-2.5">
              <input value={dob.month} onChange={(e) => setDob((s) => ({ ...s, month: e.target.value }))} inputMode="numeric" maxLength={2} placeholder="MM" className={FIELD} />
              <input value={dob.day} onChange={(e) => setDob((s) => ({ ...s, day: e.target.value }))} inputMode="numeric" maxLength={2} placeholder="DD" className={FIELD} />
              <input value={dob.year} onChange={(e) => setDob((s) => ({ ...s, year: e.target.value }))} inputMode="numeric" maxLength={4} placeholder="YYYY" className={FIELD} />
            </div>
          </div>
          {idField && (
            <label className="block"><span className={LABEL}>{idField.label}</span><input value={personalId} onChange={(e) => setPersonalId(e.target.value)} inputMode="numeric" maxLength={idField.maxLength} placeholder={idField.placeholder} className={FIELD} /></label>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {bankFields.map((spec) => (
              <BankInput key={spec.key} spec={spec} value={bank[spec.key] || ""} onChange={(v) => setBank((b) => ({ ...b, [spec.key]: v }))} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={complete} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{busy ? <FlowLoader size={14} tone="white" /> : <Check className="h-4 w-4" />} Finish setup</button>
            <button onClick={() => { setStep("intro"); setError(""); }} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Back</button>
          </div>
        </div>
      )}

      {step === "pending" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-[12.8px] font-semibold">Almost there — Stripe needs a little more</p>
              <p className="text-[11.5px] text-muted-foreground">Finish these on Stripe&apos;s secure page to enable payouts:</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {pending.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-[12.5px]"><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-amber-500/50 text-[9px] text-amber-500">{i + 1}</span> {r}</li>
            ))}
          </ul>
          <button onClick={finishOnStripe} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{busy ? <FlowLoader size={14} tone="white" /> : <ExternalLink className="h-4 w-4" />} Finish verification</button>
        </div>
      )}

      {error && <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-rose-500"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
    </SectionCard>
  );
}

function BankInput({ spec, value, onChange }: { spec: BankFieldSpec; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={LABEL}>{spec.label}{spec.hint ? <span className="ms-1 font-normal text-muted-foreground/70">· {spec.hint}</span> : null}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={spec.upper ? "text" : "numeric"} maxLength={spec.maxLength} placeholder={spec.placeholder} className={cn(FIELD, spec.upper && "uppercase")} />
    </label>
  );
}

/** Keep Stripe's own validation copy but strip anything too technical. */
function friendly(msg?: string): string {
  if (!msg || typeof msg !== "string") return "";
  if (/request id|req_|sk_|pk_|stack|undefined|null|econn|timeout|json/i.test(msg)) return "";
  return msg;
}
