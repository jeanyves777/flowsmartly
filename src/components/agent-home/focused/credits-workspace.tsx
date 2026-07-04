"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Coins, Check, Sparkles, ShieldCheck, CreditCard } from "lucide-react";
import { useStripe } from "@stripe/react-stripe-js";
import { StripeProvider } from "@/components/providers/stripe-provider";
import { AddCardForm } from "@/components/payments/add-card-form";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { cn } from "@/lib/utils/cn";

/**
 * Credits — a native /home surface for buying credit top-ups, replacing the
 * legacy /buy-credits route. Native package cards + the same proven inline Stripe
 * checkout the legacy page used (POST /api/payments/checkout, 3DS via
 * confirmCardPayment, add-card fallback). The charge is processed securely by
 * Stripe. [[new-design-no-legacy]]
 */

interface CreditPackage { id: string; name: string; credits: number; bonus: number; priceCents: number; priceFormatted: string; isPopular: boolean; }
interface PaymentMethod { id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean; }

function CreditsInner({ refreshKey, onBack }: { refreshKey?: number; onBack?: () => void }) {
  const { toast } = useToast();
  const stripe = useStripe();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const pendingPkgRef = useRef<string | null>(null);
  const packagesRef = useRef<CreditPackage[]>([]);
  useEffect(() => { packagesRef.current = packages; }, [packages]);

  const loadMethods = useCallback(async (): Promise<PaymentMethod[]> => {
    const j = await fetch("/api/payments/methods").then((r) => r.json()).catch(() => null);
    const list = j?.success && Array.isArray(j.data?.paymentMethods) ? (j.data.paymentMethods as PaymentMethod[]) : [];
    setMethods(list);
    return list;
  }, []);

  const load = useCallback(async () => {
    const [pk, cr] = await Promise.all([
      fetch("/api/payments/packages").then((r) => r.json()).catch(() => null),
      fetch("/api/user/credits").then((r) => r.json()).catch(() => null),
    ]);
    await loadMethods();
    if (pk?.success && Array.isArray(pk.data?.creditPackages)) setPackages(pk.data.creditPackages as CreditPackage[]);
    if (cr?.success && typeof cr.data?.credits === "number") setBalance(cr.data.credits);
  }, [loadMethods]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const process = useCallback(async (packageId: string, paymentMethodId: string) => {
    setBuyingId(packageId);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "credit_purchase", packageId, paymentMethodId }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error?.message || data?.error || "Payment failed");

      if (data.data.requiresAction && data.data.clientSecret && stripe) {
        const { error } = await stripe.confirmCardPayment(data.data.clientSecret);
        if (error) throw new Error(error.message || "Payment authentication failed");
      }

      // Payment succeeded. On the immediate-charge path the route returns the
      // real creditsAdded/newBalance; on the 3DS (requires_action) path both come
      // back as 0 (credits are applied by the webhook after authentication), so we
      // fall back to the package total and re-fetch the live balance. Guard with
      // truthiness (not typeof === "number"), since 0 means "not yet applied".
      const pkg = packagesRef.current.find((p) => p.id === packageId);
      const fallbackTotal = pkg ? pkg.credits + (pkg.bonus || 0) : 0;
      const added = data.data.creditsAdded || fallbackTotal;
      const newBalance = data.data.newBalance;
      if (newBalance) {
        setBalance(newBalance);
        emitCreditsUpdate(newBalance);
      } else {
        // Fallback: re-fetch the live balance (3DS path / webhook-applied credits).
        const cr = await fetch("/api/user/credits").then((r) => r.json()).catch(() => null);
        if (cr?.success && typeof cr.data?.credits === "number") {
          setBalance(cr.data.credits);
          emitCreditsUpdate(cr.data.credits);
        } else {
          emitCreditsUpdate();
        }
      }
      setJustAdded(added);
      toast({ title: "Credits added!", description: `${added.toLocaleString()} credits are now in your balance.` });
    } catch (err) {
      toast({ title: "Payment failed", description: err instanceof Error ? err.message : "Could not complete the purchase.", variant: "destructive" });
    } finally {
      setBuyingId(null);
    }
  }, [stripe, toast]);

  const buy = (pkg: CreditPackage) => {
    setJustAdded(null);
    const method = methods.find((m) => m.isDefault) || methods[0];
    if (!method) { pendingPkgRef.current = pkg.id; setShowAddCard(true); return; }
    process(pkg.id, method.id);
  };

  const onCardAdded = useCallback(async () => {
    const list = await loadMethods();
    const method = list.find((m) => m.isDefault) || list[0];
    const pending = pendingPkgRef.current;
    pendingPkgRef.current = null;
    if (pending && method) process(pending, method.id);
  }, [loadMethods, process]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading credit packs…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" aria-label="Back to billing"><ChevronLeft className="h-4 w-4" /></button>
          )}
          <div className="min-w-0">
            <h2 className="text-[18px] font-extrabold leading-tight">Buy credits</h2>
            <p className="text-[13px] text-muted-foreground">Top up instantly — credits never expire. {balance !== null && <>Balance: <span className="font-semibold text-foreground">{balance.toLocaleString()}</span>.</>}</p>
          </div>
        </div>

        {justAdded !== null && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500"><Check className="h-4 w-4" /></span>
            <p className="text-[13px] font-semibold text-emerald-600">{justAdded.toLocaleString()} credits added{balance !== null ? ` — new balance ${balance.toLocaleString()}` : ""}.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const total = pkg.credits + (pkg.bonus || 0);
            const busy = buyingId === pkg.id;
            return (
              <div key={pkg.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-4 transition", pkg.isPopular ? "border-brand-500/50 ring-1 ring-brand-500/30" : "border-border")}>
                {pkg.isPopular && <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">Best value</span>}
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Coins className="h-5 w-5" /></span>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[26px] font-extrabold leading-none">{total.toLocaleString()}</span>
                  <span className="text-[12px] font-semibold text-muted-foreground">credits</span>
                </div>
                {pkg.bonus > 0 && <p className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-500"><Sparkles className="h-3 w-3" /> {pkg.credits.toLocaleString()} + {pkg.bonus.toLocaleString()} bonus</p>}
                <div className="mt-auto pt-3">
                  <button onClick={() => buy(pkg)} disabled={!!buyingId} className={cn("inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-50", pkg.isPopular ? "bg-gradient-to-r from-brand-500 to-violet-500 shadow-brand-500/30" : "bg-foreground/90 hover:bg-foreground")}>
                    {busy ? <FlowLoader size={15} tone="white" /> : <CreditCard className="h-4 w-4" />} {busy ? "Processing…" : `Buy · ${pkg.priceFormatted}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Securely processed by Stripe. We never see your card details.</p>
      </div>

      <AddCardForm open={showAddCard} onClose={() => { setShowAddCard(false); pendingPkgRef.current = null; }} onSuccess={() => { setShowAddCard(false); onCardAdded(); }} />
    </div>
  );
}

export function FocusedCredits(props: { refreshKey?: number; onBack?: () => void }) {
  return (
    <StripeProvider>
      <CreditsInner {...props} />
    </StripeProvider>
  );
}
